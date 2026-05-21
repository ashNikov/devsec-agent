# Enable required GCP APIs for AgentSec
resource "google_project_service" "cloud_run" {
  project = var.project_id
  service = "run.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "secret_manager" {
  project = var.project_id
  service = "secretmanager.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "iam" {
  project = var.project_id
  service = "iam.googleapis.com"
  disable_on_destroy = false
}

# AgentSec Service Account — dedicated identity for the application
resource "google_service_account" "agentsec" {
  project      = var.project_id
  account_id   = "agentsec-sa"
  display_name = "AgentSec Service Account"
  description  = "Dedicated identity for AgentSec — least privilege only"
}

# Grant AgentSec Service Account minimum required permissions
resource "google_project_iam_member" "agentsec_run_viewer" {
  project = var.project_id
  role    = "roles/run.viewer"
  member  = "serviceAccount:${google_service_account.agentsec.email}"
}

resource "google_project_iam_member" "agentsec_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.agentsec.email}"
}

resource "google_project_iam_member" "agentsec_security_reviewer" {
  project = var.project_id
  role    = "roles/iam.securityReviewer"
  member  = "serviceAccount:${google_service_account.agentsec.email}"
}

# GitHub OAuth secrets in Secret Manager
resource "google_secret_manager_secret" "github_client_id" {
  project   = var.project_id
  secret_id = "github-oauth-client-id"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "github_client_secret" {
  project   = var.project_id
  secret_id = "github-oauth-client-secret"
  replication {
    auto {}
  }
}

# ── WIREGUARD LAYER ──────────────────────────────────────
# Enable Compute API via Terraform
resource "google_project_service" "compute" {
  project            = var.project_id
  service            = "compute.googleapis.com"
  disable_on_destroy = false
}

# Static external IP — WireGuard peer endpoint
resource "google_compute_address" "wireguard_ip" {
  name    = "agentsec-wireguard-ip"
  project = var.project_id
  region  = var.region
  depends_on = [google_project_service.compute]
}

# Firewall — allow WireGuard UDP + SSH for setup
resource "google_compute_firewall" "wireguard" {
  name    = "agentsec-wireguard-fw"
  project = var.project_id
  network = "default"

  allow {
    protocol = "udp"
    ports    = ["51820"]
  }

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["agentsec-wireguard"]
  depends_on    = [google_project_service.compute]
}

# e2-micro VM — WireGuard peer node
resource "google_compute_instance" "wireguard" {
  name         = "agentsec-wireguard"
  machine_type = "e2-micro"
  project      = var.project_id
  zone         = "${var.region}-a"
  tags         = ["agentsec-wireguard"]

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      size  = 10
    }
  }

  network_interface {
    network = "default"
    access_config {
      nat_ip = google_compute_address.wireguard_ip.address
    }
  }

  metadata = {
    enable-oslogin = "TRUE"
  }

  metadata_startup_script = <<-SCRIPT
    #!/bin/bash
    apt-get update -y
    apt-get install -y wireguard wireguard-tools
    echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
    sysctl -p
    echo "WireGuard installed and IP forwarding enabled" > /var/log/wireguard-setup.log
  SCRIPT

  service_account {
    email  = google_service_account.agentsec.email
    scopes = ["cloud-platform"]
  }

  depends_on = [
    google_project_service.compute,
    google_service_account.agentsec
  ]
}
