variable "project_id" {
  description = "The GCP project ID"
  type        = string
  default     = "agent-sec-496307"
}

variable "region" {
  description = "The GCP region to deploy resources"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "The deployment environment"
  type        = string
  default     = "dev"
}
