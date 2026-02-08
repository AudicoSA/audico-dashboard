# NotebookLM Integration Setup Guide

This guide explains how to set up and use the NotebookLM integration in the Audico Dashboard.

## Overview

The NotebookLM integration enables AI-powered research and content generation using Google's NotebookLM service. It supports:

- Google Cloud Project configuration
- Python fallback for notebooklm-py library
- Persistent notebook management
- Source document management
- Usage monitoring and analytics
- Artifact generation tracking

## Prerequisites

1. **Google Cloud Account**
   - Active Google Cloud project
   - Vertex AI API enabled
   - Service account with appropriate permissions

2. **Python Environment** (for fallback option)
   - Python 3.8 or higher
   - pip package manager

## Setup Instructions

### 1. Google Cloud Project Setup

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Note your Project ID

2. **Enable Vertex AI API**
   ```bash
   gcloud services enable aiplatform.googleapis.com
   ```

3. **Create Service Account**
   - Navigate to [IAM & Admin > Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
   - Click "Create Service Account"
   - Grant the following roles:
     - Vertex AI User
     - Storage Object Admin (for artifact storage)
   - Create and download a JSON key file

### 2. Dashboard Configuration

1. Navigate to **Settings > Integrations > NotebookLM**

2. **Configure Google Cloud Project**
   - Enter your Google Cloud Project ID
   - Upload the service account JSON file
   - Click "Save Configuration"

3. **Configure Python Fallback** (Optional)
   - Enter Python path (default: `python`)
   - Click "Check Installation" to verify notebooklm-py
   - If not installed, run: `pip install notebooklm-py`

4. **Test Connection**
   - Click "Run Connection Test"
   - Verify successful authentication
   - Test will create a sample notebook and generate a test infographic

## Database Schema

### notebooklm_config
Stores configuration settings for NotebookLM integration.

```sql
- id: UUID (Primary Key)
- google_cloud_project_id: TEXT
- service_account_json: JSONB
- python_path: TEXT
- notebooklm_py_installed: BOOLEAN
- connection_tested: BOOLEAN
- last_test_date: TIMESTAMPTZ
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

### notebooklm_notebooks
Tracks persistent notebooks organized by purpose.

```sql
- id: UUID (Primary Key)
- name: TEXT
- notebook_id: TEXT (Unique)
- purpose: TEXT
- sources: TEXT[]
- source_count: INTEGER
- statistics: JSONB
  - queries_count: INTEGER
  - artifacts_generated: INTEGER
  - last_activity: TIMESTAMPTZ
- status: TEXT ('active', 'inactive', 'archived', 'error')
- metadata: JSONB
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
- last_updated: TIMESTAMPTZ
```

### notebooklm_artifacts
Tracks generated artifacts (infographics, slide decks, etc.).

```sql
- id: UUID (Primary Key)
- notebook_id: UUID (Foreign Key)
- artifact_type: ENUM ('infographic', 'slide_deck', 'video_overview', 'mind_map')
- storage_path: TEXT
- thumbnail_url: TEXT
- generation_prompt: TEXT
- status: TEXT ('pending', 'generating', 'completed', 'failed', 'archived')
- linked_social_post_id: UUID
- linked_newsletter_id: UUID
- metadata: JSONB
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

### notebooklm_usage
Tracks usage metrics and statistics.

```sql
- id: UUID (Primary Key)
- api_calls_count: INTEGER
- storage_used_mb: NUMERIC
- artifact_history: JSONB[]
  - date: TEXT
  - count: INTEGER
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

## Using NotebookLM Integration

### Managing Notebooks

1. **Create a Notebook**
   - Go to "Notebook Management" tab
   - Click "Add Notebook"
   - Enter a purpose (e.g., "Product Research", "Customer Insights")
   - Click "Create"

2. **Add Sources**
   - Click "Add Source" on any notebook
   - Enter a URL or file path
   - Sources can be documents, web pages, or data files

3. **Remove Sources**
   - Click the trash icon next to any source
   - Confirm deletion

4. **Delete Notebooks**
   - Click the trash icon on the notebook card
   - Confirm deletion (this will also delete associated artifacts)

### Monitoring Usage

Navigate to the "Usage Monitoring" tab to view:

- **API Calls Count**: Total API calls this month
- **Storage Used**: Total storage consumed by artifacts
- **Artifacts Generated**: Total number of generated artifacts
- **Generation History**: Chart showing artifact generation over time
- **Usage Details**: Detailed statistics including:
  - Active notebooks
  - Total sources
  - Total queries
  - Average sources per notebook

## API Endpoints

### POST /api/notebooklm/check-python
Checks if notebooklm-py is installed.

**Request:**
```json
{
  "pythonPath": "python"
}
```

**Response:**
```json
{
  "installed": true,
  "message": "notebooklm-py is installed and accessible"
}
```

### POST /api/notebooklm/test-connection
Tests the NotebookLM connection.

**Request:**
```json
{
  "projectId": "your-project-id",
  "serviceAccountJson": { ... },
  "pythonPath": "python"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully authenticated with Google Cloud...",
  "notebook_id": "test_notebook_1234567890",
  "project_id": "your-project-id"
}
```

## Troubleshooting

### Connection Test Fails

1. **Verify Service Account Permissions**
   - Ensure the service account has Vertex AI User role
   - Check that the JSON key is valid and not expired

2. **Check Python Installation**
   - Verify Python is in PATH: `python --version`
   - Verify notebooklm-py: `pip show notebooklm-py`

3. **Verify Project ID**
   - Ensure the project ID matches your GCP project
   - Check that Vertex AI API is enabled

### Upload Fails

1. **Invalid JSON File**
   - Ensure the file is a valid service account key
   - Required fields: type, project_id, private_key, client_email

2. **File Size**
   - Service account JSON should be < 10KB

### Notebook Creation Fails

1. **Database Connection**
   - Verify Supabase connection is active
   - Check that migrations have been applied

2. **Authentication**
   - Ensure user is authenticated
   - Check RLS policies are configured correctly

## Resources

- [NotebookLM Enterprise Documentation](https://cloud.google.com/vertex-ai/generative-ai/docs/notebooklm/overview)
- [notebooklm-py GitHub](https://github.com/raivisdejus/notebooklm-python)
- [Google Cloud Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)

## Security Notes

- Service account credentials are stored securely in Supabase
- Credentials are encrypted at rest
- Never commit service account JSON files to version control
- Rotate service account keys regularly
- Use least-privilege principle when assigning roles

## Future Enhancements

- Automated artifact generation workflows
- Integration with social media posting
- Newsletter visual content generation
- Scheduled notebook updates
- Advanced analytics and insights
- Multi-user collaboration features
