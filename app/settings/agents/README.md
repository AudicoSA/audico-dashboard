# Agent Settings Configuration

This page provides comprehensive configuration for AI agents, API credentials, and notification preferences.

## Features

### 1. Agent Configuration Tab
- **Enable/Disable Agents**: Toggle agents on/off with real-time status indicators
- **Schedule Configuration**: 
  - Set cron-style execution intervals
  - Configure timezone for scheduled runs
  - Multiple intervals per agent supported
- **Token Budget Management**:
  - Set daily spending limits in USD
  - Configure per-request maximum costs
  - Real-time usage tracking with visual progress bars
- **Behavior Settings**:
  - Auto-approve actions toggle
  - Require human review option
  - Max retries configuration
  - Timeout settings in seconds

### 2. API Credentials Tab
- **Supported Services**:
  - Gmail OAuth (Client ID, Client Secret, Refresh Token)
  - Google Ads (Developer Token, Client credentials)
  - Social Platforms (Facebook, Twitter, Instagram, LinkedIn, YouTube, TikTok)
- **Security Features**:
  - Hidden key values (show/hide toggle)
  - Expiration date tracking
  - Secure storage in Supabase
- **Management**:
  - Add new credentials via modal
  - Delete existing credentials
  - Visual service icons for easy identification

### 3. Notifications Tab
- **Event Types**:
  - Agent errors
  - Task completions
  - Order received
  - Stock alerts
  - Customer escalations
  - Kenny mentions
  - Budget exceeded
  - Approval required
  - Daily summaries
  - Social engagement
- **Channel Options**:
  - Email
  - SMS
  - Slack
  - Dashboard
- **Kenny Mentions**: Special toggle to only notify when Kenny is mentioned

## Database Schema

### agent_configs
```sql
- id: UUID (Primary Key)
- name: TEXT (Unique)
- enabled: BOOLEAN
- schedule: JSONB (enabled, intervals[], timezone)
- token_budget: JSONB (daily_limit, per_request_max, current_usage)
- behavior_settings: JSONB (auto_approve, require_review, max_retries, timeout_seconds)
- created_at, updated_at: TIMESTAMPTZ
```

### api_credentials
```sql
- id: UUID (Primary Key)
- service: TEXT
- key_name: TEXT
- key_value: TEXT
- expires_at: TIMESTAMPTZ (nullable)
- created_at, updated_at: TIMESTAMPTZ
- UNIQUE(service, key_name)
```

### notification_preferences
```sql
- id: UUID (Primary Key)
- event_type: TEXT (Unique)
- enabled: BOOLEAN
- channels: TEXT[]
- kenny_mentions_only: BOOLEAN
- created_at, updated_at: TIMESTAMPTZ
```

## Setup Instructions

1. **Run Migration**: Execute `supabase/migrations/004_agent_settings.sql` in your Supabase SQL Editor
2. **Update Credentials**: Replace placeholder credential values with actual API keys
3. **Configure Agents**: Navigate to `/settings/agents` and configure each agent
4. **Set Budgets**: Adjust token budgets based on usage patterns
5. **Enable Notifications**: Configure notification channels for your team

## Usage

### Configuring an Agent
1. Navigate to Settings > Agent Settings
2. Select "Agent Configuration" tab
3. Click the settings icon on an agent card
4. Configure schedule, budget, and behavior settings
5. Click "Save Changes"

### Adding API Credentials
1. Select "API Credentials" tab
2. Click "Add Credential"
3. Choose service from dropdown
4. Enter key name and value
5. Optionally set expiration date
6. Click "Add Credential"

### Managing Notifications
1. Select "Notifications" tab
2. Toggle notifications on/off per event type
3. Select notification channels
4. Enable "Kenny mentions only" for priority alerts
5. Changes save automatically

## Security Notes

- All credentials are stored encrypted in Supabase
- Row Level Security (RLS) is enabled on all tables
- API keys are hidden by default in the UI
- Consider implementing additional authentication for production use
- Regularly rotate API credentials and update expiration dates

## Future Enhancements

- OAuth 2.0 flow integration for Gmail
- Credential encryption at rest
- Audit logs for configuration changes
- Multi-user permission levels
- Credential usage analytics
- Budget alerts and auto-throttling
