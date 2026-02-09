# White-Label Multi-Tenant System

## Overview

The white-label multi-tenant system enables approved resellers to deploy branded versions of Mission Control for their business. Each tenant operates in complete isolation with customizable branding, product catalogs, customer management, and dedicated agent instances.

## Architecture

### Tenant Isolation

All tenant data is isolated using row-level security (RLS) policies in Supabase. Each tenant has:
- Unique subdomain (`reseller-name.audico-platform.com`)
- Optional custom domain support
- Isolated database records scoped by `tenant_id`
- Dedicated API keys for integration

### Key Components

1. **Tenant Configuration** (`reseller_tenants`)
   - Branding (logo, colors, fonts)
   - Feature flags
   - Billing settings
   - Territory assignments

2. **Product Catalog** (`tenant_products`)
   - Filtered by assigned categories
   - Markup pricing
   - Custom product details

3. **Customer Management** (`tenant_customers`)
   - Territory-scoped customers
   - Order tracking
   - Customer lifecycle

4. **Agent Instances** (`tenant_agents`)
   - Dedicated agent configurations per tenant
   - Isolated performance tracking

5. **API Key Management** (`tenant_api_keys`)
   - Secure API access for integrations
   - Permission-based access control
   - Usage tracking

## Admin Portal

### Tenant Management

Navigate to `/admin-portal/tenants` to:

- **View All Tenants**: List all white-label deployments with status, plan tier, and usage
- **Create Tenant**: Set up new tenant with company details, subdomain, and billing
- **Manage Tenant**: Configure branding, features, products, and API keys

### Tenant Detail Page

Each tenant has a comprehensive management interface with tabs:

1. **General**: Basic info, domain settings, status, and billing
2. **Branding**: Logo, colors, fonts with live preview
3. **Products**: Product catalog with markup pricing
4. **Customers**: Customer list and management
5. **API Keys**: Generate and manage API keys
6. **Usage**: Track API calls, agent actions, and costs

## Reseller Tenant Portal

### Subdomain Access

Tenants access their portal via:
- `subdomain.audico-platform.com` (automatic)
- Custom domain (after verification)

### Available Features

Tenants can access (based on feature flags):
- **Dashboard**: Overview with stats and quick actions
- **Products**: Browse and manage product catalog
- **Customers**: View and manage customers
- **Settings**: View API keys and preferences

### Branding

Each tenant portal displays:
- Custom logo and favicon
- Brand colors throughout the interface
- Selected font family
- Company name in navigation

## API Endpoints

### Admin Endpoints

**Tenant Management**
- `GET /api/admin/tenants` - List all tenants
- `POST /api/admin/tenants` - Create new tenant
- `GET /api/admin/tenants/[id]` - Get tenant details
- `PUT /api/admin/tenants/[id]` - Update tenant
- `DELETE /api/admin/tenants/[id]` - Delete tenant

**Tenant Resources**
- `GET /api/admin/tenants/[id]/products` - List tenant products
- `POST /api/admin/tenants/[id]/products/sync` - Sync products from catalog
- `GET /api/admin/tenants/[id]/customers` - List tenant customers
- `POST /api/admin/tenants/[id]/customers` - Create customer
- `GET /api/admin/tenants/[id]/api-keys` - List API keys
- `POST /api/admin/tenants/[id]/api-keys` - Generate API key
- `GET /api/admin/tenants/[id]/usage` - Get usage metrics

### Tenant Endpoints

**Tenant Context**
- `GET /api/tenant/context?tenant=[slug]` - Get tenant configuration
- `GET /api/tenant/stats?tenant=[slug]` - Get tenant statistics

**Tenant Resources**
- `GET /api/tenant/products?tenant=[slug]` - List available products
- `GET /api/tenant/api-keys?tenant=[slug]` - List tenant's API keys

## Database Schema

### Core Tables

**reseller_tenants**
- Tenant configuration and branding
- Billing and plan settings
- Feature flags
- Territory assignments

**tenant_products**
- Product catalog with markup pricing
- Visibility and availability flags
- Custom product details

**tenant_customers**
- Customer records scoped by tenant
- Territory validation
- Order history

**tenant_orders**
- Order management per tenant
- Fulfillment tracking
- Financial details

**tenant_agents**
- Dedicated agent instances
- Configuration and performance

**tenant_api_keys**
- API key management
- Permission scoping
- Usage tracking

**tenant_usage_metrics**
- Daily usage tracking
- Cost estimation
- Agent-specific metrics

**tenant_audit_log**
- Audit trail of all tenant activities
- Security and compliance

### Helper Functions

**get_tenant_by_subdomain(subdomain)**
- Retrieve tenant configuration by subdomain

**get_tenant_by_domain(domain)**
- Retrieve tenant by custom domain

**validate_tenant_api_key(key_hash)**
- Validate and track API key usage

**record_tenant_usage(tenant_id, metric_type, count)**
- Record usage metrics for billing

**sync_products_to_tenant(tenant_id, category_filter)**
- Sync products from main catalog to tenant

## Security

### Row-Level Security (RLS)

All tenant tables have RLS policies that enforce:
- Data isolation by `tenant_id`
- Authenticated access only
- Proper scoping for all operations

### API Key Security

- Keys are hashed using SHA-256
- Only prefixes are stored for display
- Full keys shown only once at creation
- Usage tracking for audit

### Territory Validation

Customers can be assigned to specific territories to ensure:
- Geographic compliance
- Market segmentation
- License restrictions

## Subdomain Routing

### Middleware

The Next.js middleware (`middleware.ts`) handles:
- Subdomain detection from host header
- Rewriting URLs to tenant-specific routes
- Parameter injection for tenant context

### Custom Domains

Tenants can configure custom domains:
1. Add custom domain in admin portal
2. Configure DNS CNAME to point to platform
3. Verify domain ownership
4. Enable custom domain in tenant settings

## Branding Configuration

### Available Options

- **Logo URL**: Full URL to company logo
- **Favicon URL**: Full URL to favicon
- **Primary Color**: Main brand color (hex)
- **Secondary Color**: Secondary brand color (hex)
- **Accent Color**: Accent/text color (hex)
- **Font Family**: Selected from predefined list

### Implementation

Branding is applied through:
- Inline styles for dynamic colors
- CSS variables for theming
- Font family injection
- Logo/favicon in HTML head

## Product Catalog Management

### Product Syncing

Products are synced from the main catalog to tenants based on:
- Assigned product categories
- Visibility flags
- Stock availability

### Markup Pricing

Each tenant can have:
- Global markup percentage (tenant-level)
- Custom prices per product (override)
- Calculated final price (automatic)

Formula: `final_price = custom_price ?? (base_price * (1 + markup_percentage / 100))`

## Usage Tracking & Billing

### Metrics Tracked

Daily metrics per tenant:
- API calls
- Agent actions (by type)
- Customers managed
- Orders processed
- Storage used (MB)
- Estimated cost

### Billing Integration

The system tracks:
- Monthly recurring fees
- Usage-based charges
- Plan tier features
- Trial periods
- Billing status

## Customer Management

### Territory Scoping

Customers can be filtered by:
- Geographic territory
- Market segment
- License zones

### Customer Lifecycle

Track customer journey:
- Total orders
- Total spent
- Last order date
- Activity status

## Agent Instances

### Per-Tenant Agents

Each tenant can have dedicated instances of:
- Email Agent
- Social Media Agent
- Marketing Agent
- Support Agent
- Sales Agent

### Configuration

Agents can be configured with:
- Tenant-specific settings
- Custom prompts
- Integration credentials
- Performance tracking

## Best Practices

### Setting Up a New Tenant

1. Create tenant in admin portal
2. Configure branding
3. Assign product categories
4. Set markup percentage
5. Sync products
6. Generate API keys
7. Enable features as needed
8. Test tenant portal access

### Security Considerations

- Always use HTTPS for custom domains
- Rotate API keys regularly
- Monitor usage metrics for anomalies
- Review audit logs periodically
- Enforce strong password policies

### Performance Optimization

- Cache tenant configurations
- Use CDN for static assets
- Optimize product queries
- Index frequently queried fields
- Monitor database performance

## Troubleshooting

### Subdomain Not Working

- Verify DNS configuration
- Check middleware routing
- Ensure tenant status is 'active'
- Validate subdomain format

### Products Not Showing

- Check assigned product categories
- Verify product sync completed
- Ensure products are visible and available
- Review markup pricing calculation

### API Key Issues

- Verify key is active and not expired
- Check rate limits
- Validate permissions
- Review usage count

## Future Enhancements

Planned features:
- Multi-language support
- Advanced analytics dashboard
- White-label mobile apps
- Tenant-specific workflows
- Custom agent training
- Advanced billing automation
