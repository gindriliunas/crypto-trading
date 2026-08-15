provider "aws" {
  region = "eu-west-2" # London region
}
resource "aws_s3_bucket" "terraformstatefolder" {
  bucket = "terraformstatefolder-631026310596"
}
terraform {
  backend "s3" {
    bucket         = "terraformstatefolder-631026310596"
    key            = "global/s3/terraform.tfstate"
    region         = "eu-west-2"
  }
}