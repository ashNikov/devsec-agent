output "service_account_email" {
  description = "AgentSec Service Account email"
  value       = google_service_account.agentsec.email
}

output "project_id" {
  description = "GCP Project ID"
  value       = var.project_id
}

output "region" {
  description = "GCP Region"
  value       = var.region
}
