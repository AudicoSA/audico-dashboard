# Customer Self-Service Portal

A comprehensive customer portal enabling customers to track interactions, manage support tickets, view orders, and get AI-powered assistance.

## Features

### 1. **Authenticated Customer Dashboard**
- Personalized welcome screen
- Overview of account activity
- Quick access to all portal features
- Real-time statistics on orders, tickets, and quotes

### 2. **Order History**
- View all past orders with details
- Track order status and shipping
- Download invoices
- View order items and totals
- Filter and search orders

### 3. **Support Tickets**
- Create new support tickets
- Track ticket status with AI-generated updates
- Real-time messaging with support agents
- Upload files and attachments (images, PDFs, documents)
- Categorize tickets (technical, billing, product, shipping, etc.)
- Priority levels (low, medium, high, urgent)

### 4. **Quote Requests**
- View all quote requests and their status
- Track quote progress
- Download quote PDFs
- Accept or request changes to quotes

### 5. **Scheduled Calls**
- Schedule calls with support team
- View upcoming and past calls
- Access call transcripts after completion
- Reschedule or cancel appointments

### 6. **AI Chatbot**
- RAG-powered chatbot using product catalog and past interactions
- Context-aware responses based on customer history
- Knowledge base integration
- Automatic escalation to support tickets when needed
- Source citation for transparency

### 7. **Profile Management**
- Update personal information
- View reseller application status
- Manage preferences

### 8. **POPIA Compliance**
- Complete audit logging of all data access
- Data export functionality
- Data deletion requests
- Access control and permissions
- Transparent data usage tracking

## Technical Architecture

### Database Tables

#### Portal Users
- Stores customer authentication and profile data
- Links to Supabase Auth for authentication
- Connects to customer_profiles for historical data

#### Support Tickets
- Full ticket lifecycle management
- AI-generated status updates
- Categorization and prioritization
- SLA tracking

#### Ticket Messages
- Conversation threads
- Customer and agent messages
- Internal notes (hidden from customers)
- File attachment support

#### Ticket Attachments
- File storage with Supabase Storage
- Virus scanning status tracking
- File type and size validation
- Secure access control

#### Scheduled Calls
- Call scheduling and management
- Integration with call transcripts
- Reminder system ready

#### Portal Audit Log
- POPIA-compliant logging
- IP address and user agent tracking
- Data access tracking
- Purpose documentation

#### Chatbot Sessions
- Session management
- Context preservation
- Escalation tracking

#### Knowledge Base
- RAG data source
- Categorized articles
- Helpful/unhelpful tracking
- Performance metrics

## API Endpoints

### Authentication
- `POST /api/portal/auth/login` - User login
- `POST /api/portal/auth/register` - New user registration

### Tickets
- `GET /api/portal/tickets` - List user's tickets
- `POST /api/portal/tickets` - Create new ticket
- `GET /api/portal/tickets/[id]/messages` - Get ticket messages
- `POST /api/portal/tickets/[id]/messages` - Add message to ticket

### Orders
- `GET /api/portal/orders` - Get user's order history

### Quotes
- `GET /api/portal/quotes` - Get user's quote requests

### Calls
- `GET /api/portal/calls` - Get scheduled calls
- `POST /api/portal/calls` - Schedule new call

### Chatbot
- `POST /api/portal/chatbot` - Send message to AI chatbot

### Uploads
- `POST /api/portal/uploads` - Upload file to ticket

### Profile
- `GET /api/portal/profile` - Get user profile
- `PUT /api/portal/profile` - Update user profile

## Pages

### Dashboard (`/portal/dashboard`)
- Overview of customer account
- Recent activity feed
- Quick action buttons
- Statistics cards

### Tickets (`/portal/tickets`)
- List all support tickets
- Filter and search
- Create new tickets
- Ticket status tracking

### Ticket Detail (`/portal/tickets/[id]`)
- Full ticket conversation
- Message thread
- File uploads
- AI status updates

### Orders (`/portal/orders`)
- Complete order history
- Order details and tracking
- Invoice downloads
- Shipping information

### Quotes (`/portal/quotes`)
- Quote request tracking
- Quote PDF downloads
- Accept/reject quotes

### Calls (`/portal/calls`)
- Schedule new calls
- View upcoming appointments
- Access past call transcripts

### Chat (`/portal/chat`)
- AI chatbot interface
- Real-time messaging
- Context-aware responses
- Source citations

### Profile (`/portal/profile`)
- Personal information management
- Reseller status
- POPIA data controls

## Security Features

### Authentication
- Supabase Auth integration
- Row Level Security (RLS) policies
- Session management
- Email verification

### Data Access
- User-specific data filtering
- RLS policies on all tables
- Audit logging for all operations
- POPIA-compliant data access controls

### File Uploads
- File type validation
- Size limits (10MB)
- Virus scanning integration ready
- Secure storage with Supabase Storage

### Privacy
- Audit log for all data access
- Data export functionality
- Data deletion requests
- Transparent data usage

## AI Features

### Ticket AI Status Updates
- Automatic status generation when ticket is created
- Natural language summaries
- Expected resolution timeframes

### Chatbot RAG
- Product catalog integration
- Customer history context
- Knowledge base search
- Past interaction awareness
- Order and ticket context

### Context Awareness
- Customer purchase history
- Recent tickets
- Communication preferences
- Previous conversations

## Integration Points

### Existing Systems
- Customer Profiles (customer_profiles)
- OpenCart Orders (opencart_orders_cache)
- Quote Requests (quote_requests)
- Call Transcripts (call_transcripts)
- Reseller Applications (reseller_applications)
- Email Correspondence (email_logs)

### External Services
- Supabase Auth - Authentication
- Supabase Storage - File uploads
- Claude AI - Chatbot responses
- Email notifications (ready for integration)

## Setup Instructions

### 1. Database Migration
Run the migration file:
```bash
# Apply the migration
psql your_database < supabase/migrations/008_customer_portal.sql
```

### 2. Supabase Storage
Create storage bucket for attachments:
```sql
-- Create bucket for ticket attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-attachments', 'ticket-attachments', true);

-- Set up storage policies
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ticket-attachments');

CREATE POLICY "Users can view own uploads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'ticket-attachments');
```

### 3. Environment Variables
Ensure these are set:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_anthropic_key
```

### 4. Knowledge Base
Populate the knowledge base with initial data:
```sql
-- Example knowledge base entries
INSERT INTO knowledge_base (category, title, content, keywords, status)
VALUES 
  ('faq', 'How do I track my order?', 'You can track your order by...', ARRAY['order', 'tracking', 'shipping'], 'active'),
  ('product', 'Speaker Setup Guide', 'To set up your speakers...', ARRAY['speaker', 'setup', 'installation'], 'active');
```

## Usage

### Customer Registration
1. Customer visits `/portal/dashboard`
2. Registers with email and password
3. Email verification sent
4. Profile automatically linked to existing customer data if email matches

### Creating Support Tickets
1. Navigate to `/portal/tickets`
2. Click "New Ticket"
3. Fill in subject, description, category, and priority
4. Submit ticket
5. AI generates initial status update
6. Customer can add messages and upload files

### Using AI Chatbot
1. Click floating "Chat with AI" button
2. Type questions about products, orders, or issues
3. AI provides contextual responses using:
   - Customer's order history
   - Recent tickets
   - Knowledge base articles
   - Product information

### Scheduling Calls
1. Navigate to `/portal/calls`
2. Click "Schedule Call"
3. Select date/time and purpose
4. Receive confirmation
5. Access transcript after call completion

## POPIA Compliance

### Data Access Logging
Every data access is logged with:
- User ID
- Action type
- Resource accessed
- IP address
- Timestamp
- Purpose
- Fields accessed

### Data Rights
Customers can:
- View all their data
- Export data in portable format
- Request data correction
- Request data deletion
- Restrict data processing

### Audit Trail
Complete audit trail maintained for:
- Login/logout events
- Profile updates
- Ticket creation and viewing
- Order history access
- Data export requests
- File uploads

## Future Enhancements

- [ ] Push notifications for ticket updates
- [ ] SMS reminders for scheduled calls
- [ ] Live chat escalation
- [ ] Customer satisfaction surveys
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Mobile app
- [ ] Integration with shipping carriers
- [ ] Payment processing
- [ ] Product recommendations based on history

## Support

For technical support or questions about the customer portal, contact the development team.
