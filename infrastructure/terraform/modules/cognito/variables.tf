variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "callback_urls" {
  description = "Callback URLs for OAuth"
  type        = list(string)
  default     = ["http://localhost:5173", "http://localhost:5173/callback"]
}

variable "logout_urls" {
  description = "Logout URLs"
  type        = list(string)
  default     = ["http://localhost:5173"]
}
