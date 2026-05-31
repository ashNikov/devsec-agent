# Enable required GCP APIs for AgentSec
resource "google_project_service" "cloud_run" {
  project            = var.project_id
  service            = "run.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "secret_manager" {
  project            = var.project_id
  service            = "secretmanager.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "iam" {
  project            = var.project_id
  service            = "iam.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "compute" {
  project            = var.project_id
  service            = "compute.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "artifact_registry" {
  project            = var.project_id
  service            = "artifactregistry.googleapis.com"
  disable_on_destroy = false
}

# AgentSec Service Account
resource "google_service_account" "agentsec" {
  project      = var.project_id
  account_id   = "agentsec-sa"
  display_name = "AgentSec Service Account"
  description  = "Dedicated identity for AgentSec — least privilege only"
}

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

# GitHub OAuth secrets
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

resource "google_secret_manager_secret" "db_url" {
  project   = var.project_id
  secret_id = "AGENTSEC_DB_URL"
  replication {
    auto {}
  }
}

# WireGuard static IP
resource "google_compute_address" "wireguard_ip" {
  name       = "agentsec-wireguard-ip"
  project    = var.project_id
  region     = var.region
  depends_on = [google_project_service.compute]
}

# WireGuard firewall
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

# WireGuard VM
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
    google_service_account.agentsec,
  ]
}

# Artifact Registry
resource "google_artifact_registry_repository" "agentsec" {
  project       = var.project_id
  location      = var.region
  repository_id = "agentsec"
  format        = "DOCKER"
  description   = "AgentSec Docker images"
  depends_on    = [google_project_service.artifact_registry]
}

resource "google_artifact_registry_repository_iam_member" "agentsec_writer" {
  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.agentsec.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.agentsec.email}"
}

# Cloud Run staging service
resource "google_cloud_run_v2_service" "agentsec_staging" {
  project  = var.project_id
  name     = "agentsec-staging"
  location = var.region

  template {
    service_account = google_service_account.agentsec.email

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/agentsec/backend:latest"

      ports {
        container_port = 8000
      }

      env {
        name  = "ENVIRONMENT"
        value = "staging"
      }

      env {
        name  = "ALLOWED_ORIGINS"
        value = "http://localhost:3000"
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }
  }

  depends_on = [
    google_project_service.cloud_run,
    google_artifact_registry_repository.agentsec,
  ]
}

# Make staging publicly accessible
resource "google_cloud_run_v2_service_iam_member" "staging_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.agentsec_staging.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
# Enable Cloud SQL API
resource "google_project_service" "sqladmin" {
  project            = var.project_id
  service            = "sqladmin.googleapis.com"
  disable_on_destroy = false
}

# Cloud SQL PostgreSQL instance
resource "google_sql_database_instance" "agentsec" {
  project          = var.project_id
  name             = "agentsec-db"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier = "db-f1-micro"

    backup_configuration {
      enabled = true
    }

    ip_configuration {
      ipv4_enabled = true
      authorized_networks {
        name  = "allow-all-temp"
        value = "0.0.0.0/0"
      }
    }
  }

  deletion_protection = false
  depends_on          = [google_project_service.sqladmin]
}

# Create the agentsec database
resource "google_sql_database" "agentsec" {
  project  = var.project_id
  name     = "agentsec"
  instance = google_sql_database_instance.agentsec.name
}

# Create DB user
resource "google_sql_user" "agentsec" {
  project  = var.project_id
  name     = "agentsec"
  instance = google_sql_database_instance.agentsec.name
  password = "AgentSec2026!Secure"
}

# Grant service account Cloud SQL access
resource "google_project_iam_member" "agentsec_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.agentsec.email}"
}