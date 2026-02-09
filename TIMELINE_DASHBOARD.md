# Customer Interaction Timeline Dashboard

## Overview

The Customer Interaction Timeline Dashboard provides a unified view of all customer touchpoints across multiple channels in Mission Control. It aggregates data from:

- **Call Transcripts**: AI call system webhook integration
- **Email Threads**: Gmail/email logs with classification and response history
- **Quote Chat Sessions**: Real-time chat interactions linked by customer email/phone
- **Social Media Interactions**: Brand mentions and DMs from Facebook, Instagram, Twitter, etc.
- **Order History**: OpenCart database integration for purchase tracking

## Features

### 1. Unified Timeline View
- Chronological display of all customer interactions
- Color-coded by source (calls, emails, chats, social, orders)
- Sentiment analysis indicators
- Expandable details for each interaction
- Real-time filtering by interaction type and date range

### 2. Customer Profile Sidebar
- Contact information (email, phone, company)
- Purchase history and order statistics
- Lifetime Value (LTV) calculation
- Average order value
- Total interaction count
- Sentiment score and trend analysis (improving, stable, declining)
- Customer status (Active, VIP, Inactive, Blocked)

### 3. Advanced Filtering
- Filter by interaction source: Calls, Emails, Chat, Social, Orders
- Date range filtering (from/to)
- Search by customer name, email, phone, or company
- Customer categorization: Recent, Top LTV, Needs Attention

### 4. Customer Insights
- Sentiment tracking across all interactions
- Trend analysis (improving/declining sentiment)
- Interaction frequency metrics
- Channel preference insights
- Response time tracking

## API Endpoints

### Timeline Data

#### GET `/api/timeline`

**Actions:**

1. **Get Customer Timeline**
   ```
   GET /api/timeline?action=timeline&customerId={id}&sources=call,email&dateFrom=2024-01-01&dateTo=2024-12-31&limit=100
   ```

2. **Get Customer Profile**
   ```
   GET /api/timeline?action=profile&customerId={id}
   ```

3. **Search Customers**
   ```
   GET /api/timeline?action=search&query={searchTerm}
   ```

4. **Get Recent Customers**
   ```
   GET /api/timeline?action=recent&limit=20
   ```

5. **Get Top Customers by LTV**
   ```
   GET /api/timeline?action=top&limit=10
   ```

6. **Get Customers Needing Attention**
   ```
   GET /api/timeline?action=attention
   ```

7. **Get Customer Details** (All data sources)
   ```
   GET /api/timeline?action=customer_details&customerId={id}
   ```

8. **Get Email Threads**
   ```
   GET /api/timeline?action=email_threads&customerId={id}
   ```

9. **Get Quote Sessions**
   ```
   GET /api/timeline?action=quote_sessions&customerId={id}
   ```

10. **Get Order History**
    ```
    GET /api/timeline?action=order_history&customerId={id}
    ```

#### POST `/api/timeline`

**Update Customer Profile**
```json
{
  "action": "update_profile",
  "customerId": "customer@example.com"
}
```

### Sync Data

#### POST `/api/sync`

**Actions:**

1. **Sync OpenCart Order**
   ```json
   {
     "action": "sync_opencart_order",
     "data": {
       "order_id": 12345,
       "customer_id": 67890,
       "customer_name": "John Doe",
       "customer_email": "john@example.com",
       "customer_phone": "+27123456789",
       "order_status": "Complete",
       "order_total": 1299.99,
       "currency": "ZAR",
       "payment_method": "Credit Card",
       "shipping_method": "Standard Shipping",
       "items": [...],
       "shipping_address": {...},
       "order_date": "2024-01-15T10:30:00Z"
     }
   }
   ```

2. **Sync Social Interaction**
   ```json
   {
     "action": "sync_social_interaction",
     "data": {
       "platform": "instagram",
       "interaction_type": "mention",
       "customer_name": "Jane Smith",
       "customer_email": "jane@example.com",
       "customer_handle": "@janesmith",
       "content": "Love your products!",
       "sentiment": "positive",
       "post_url": "https://instagram.com/p/abc123",
       "requires_response": false,
       "interaction_date": "2024-01-15T14:20:00Z",
       "metadata": {}
     }
   }
   ```

3. **Sync Quote Session**
   ```json
   {
     "action": "sync_quote_session",
     "data": {
       "session_id": "qs_abc123",
       "customer_name": "Bob Wilson",
       "customer_email": "bob@example.com",
       "customer_phone": "+27987654321",
       "company_name": "Wilson Corp",
       "status": "quote_sent",
       "total_amount": 5499.99,
       "currency": "ZAR",
       "quote_items": [...],
       "created_at": "2024-01-15T09:00:00Z",
       "last_activity_at": "2024-01-15T11:30:00Z",
       "metadata": {}
     }
   }
   ```

4. **Sync Email Thread**
   ```json
   {
     "action": "sync_email_thread",
     "data": {
       "email_id": "msg_xyz789",
       "from_email": "customer@example.com",
       "from_name": "Customer Name",
       "subject": "Product inquiry",
       "body": "I'm interested in...",
       "category": "inquiry",
       "status": "classified",
       "sentiment": "neutral",
       "created_at": "2024-01-15T08:45:00Z",
       "metadata": {}
     }
   }
   ```

5. **Bulk Update Profiles**
   ```json
   {
     "action": "bulk_update_profiles",
     "data": {
       "customer_ids": ["email1@example.com", "email2@example.com"]
     }
   }
   ```

### Webhooks

#### POST `/api/webhooks/timeline`

**Authentication**: Bearer token in Authorization header

**Supported Webhook Types:**

1. **Quote Session Update**
   ```json
   {
     "type": "quote_session_update",
     "data": {
       "session_id": "qs_abc123",
       "customer_name": "John Doe",
       "customer_email": "john@example.com",
       "customer_phone": "+27123456789",
       "company_name": "Doe Enterprises",
       "status": "active",
       "total_amount": 2499.99,
       "currency": "ZAR",
       "quote_items": [],
       "created_at": "2024-01-15T10:00:00Z",
       "last_activity_at": "2024-01-15T10:30:00Z",
       "metadata": {}
     }
   }
   ```

2. **Social Interaction**
   ```json
   {
     "type": "social_interaction",
     "data": {
       "platform": "twitter",
       "interaction_type": "mention",
       "customer_name": "Jane Doe",
       "customer_handle": "@janedoe",
       "content": "Great service!",
       "sentiment": "positive",
       "post_url": "https://twitter.com/user/status/123",
       "requires_response": false,
       "interaction_date": "2024-01-15T11:00:00Z"
     }
   }
   ```

3. **OpenCart Order**
   ```json
   {
     "type": "opencart_order",
     "data": {
       "order_id": 12345,
       "customer_id": 67890,
       "customer_name": "Bob Smith",
       "customer_email": "bob@example.com",
       "order_status": "Complete",
       "order_total": 899.99,
       "currency": "ZAR",
       "order_date": "2024-01-15T09:30:00Z"
     }
   }
   ```

4. **Email Thread**
   ```json
   {
     "type": "email_thread",
     "data": {
       "email_id": "msg_abc123",
       "from_email": "customer@example.com",
       "from_name": "Customer Name",
       "subject": "Support request",
       "body": "I need help with...",
       "category": "support",
       "status": "unread",
       "sentiment": "neutral",
       "created_at": "2024-01-15T12:00:00Z"
     }
   }
   ```

#### GET `/api/webhooks/timeline`

Returns webhook endpoint information and supported types.

### Call System Integration

The call system webhook is already integrated at `/api/integrations/call-system`.

**POST** `/api/integrations/call-system`

Receives call transcripts from the AI call system and automatically:
- Stores transcript in `call_transcripts` table
- Creates timeline entry in `customer_interactions`
- Generates follow-up tasks based on call outcome
- Updates customer profile statistics
- Triggers sentiment analysis

## Database Schema

### Tables

1. **call_transcripts**: AI call system transcripts
2. **email_logs**: Gmail email tracking with classification
3. **customer_interactions**: Unified interaction records (chat sessions via reference)
4. **social_interactions**: Social media mentions and DMs
5. **opencart_orders_cache**: Cached OpenCart order data
6. **customer_profiles**: Unified customer profiles with LTV and sentiment

### Views

**customer_timeline_unified**: Unified view combining all interaction sources

```sql
SELECT * FROM customer_timeline_unified
WHERE customer_email = 'customer@example.com'
ORDER BY interaction_date DESC;
```

### Functions

**update_customer_profile_stats(p_customer_id TEXT)**: Recalculates customer statistics
- Total orders and spend
- Average order value
- Lifetime value (LTV)
- Sentiment score
- Interaction count
- First/last interaction dates

## Usage Examples

### Frontend Implementation

The timeline dashboard is accessible at `/timeline` in Mission Control.

**Key Components:**

1. **Customer List**: Left sidebar with search and filters
2. **Customer Profile Card**: Displays key metrics and contact info
3. **Timeline View**: Chronological list of all interactions
4. **Filter Panel**: Source and date range filters

### Integrating New Data Sources

To add a new interaction source:

1. **Add to sync API** (`app/api/sync/route.ts`):
   ```typescript
   case 'sync_new_source': {
     // Implementation
   }
   ```

2. **Create webhook handler** if needed
3. **Update database view** if necessary
4. **Add source to frontend filters**

### Customer Profile Updates

Customer profiles are automatically updated when:
- New interactions are added
- Orders are synchronized
- Call transcripts are received
- Sentiment analysis completes

Manual updates:
```typescript
await fetch('/api/timeline', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'update_profile',
    customerId: 'customer@example.com'
  })
})
```

## Environment Variables

```env
# Timeline webhook authentication (optional)
TIMELINE_WEBHOOK_SECRET=your_secret_key_here

# Call system webhook authentication
CALL_SYSTEM_WEBHOOK_SECRET=your_call_system_secret

# Quote chat Supabase (for external quote system)
AUDICO_CHAT_QUOTE_SUPABASE_URL=your_quote_chat_url
AUDICO_CHAT_QUOTE_SUPABASE_KEY=your_quote_chat_key
```

## Future Enhancements

- Export timeline to PDF/CSV
- Automated customer segmentation
- Predictive churn analysis
- Integration with CRM systems
- Real-time notifications for high-value customer interactions
- Advanced sentiment trend charts
- Multi-channel conversation threading
- AI-powered interaction summaries
- Customer journey mapping
- Automated response suggestions
