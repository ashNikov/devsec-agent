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
