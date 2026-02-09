# White-Label Multi-Tenant System - Quick Start Guide

## Overview

This guide will help you quickly set up and deploy a white-label tenant for a reseller.

## Prerequisites

- Mission Control platform running
- Admin access to the platform
- Approved reseller information
- DNS access (for custom domains, optional)

## Step 1: Create a New Tenant

1. Navigate to the Admin Portal: `/admin-portal/tenants`
2. Click **"New Tenant"**
3. Fill in the required information:
   - **Company Name**: Reseller's company name (e.g., "Acme Corporation")
   - **Subdomain**: Auto-generated from company name or customize (e.g., "acme")
   - **Reseller ID**: Link to existing reseller record (optional)
   - **Plan Tier**: Select Basic, Professional, or Enterprise
   - **Monthly Fee**: Set recurring fee in ZAR
   - **Product Markup %**: Set default markup percentage (e.g., 15%)
   - **Billing Status**: Start as "Trial" or "Active"
4. Click **"Create Tenant"**

The tenant will be created with status "Pending Setup"

## Step 2: Configure Branding

1. Go to tenant detail page
2. Click the **"Branding"** tab
3. Configure:
   - **Logo URL**: Upload logo and provide URL
   - **Favicon URL**: Upload favicon and provide URL
   - **Primary Color**: Choose brand color (e.g., #84cc16)
   - **Secondary Color**: Choose secondary color (e.g., #000000)
   - **Accent Color**: Choose accent color (e.g., #ffffff)
   - **Font Family**: Select from dropdown
4. Preview the branding
5. Click **"Save Changes"**

## Step 3: Configure Features

1. In the **"General"** tab
2. Scroll to Features section (or use a feature toggle UI)
3. Enable/disable features:
   - ✓ Dashboard (always enabled)
   - ✓ Products
   - ✓ Customers
   - ✓ Orders
   - ✓ Analytics
   - ✓ Support
   - ✓ Agents
   - ☐ Social Media (optional)
   - ☐ Email Automation (optional)
   - ☐ Marketing (optional)
4. Click **"Save Changes"**

## Step 4: Sync Products

1. Click the **"Products"** tab
2. (Optional) In General tab, assign product categories to filter catalog
3. Click **"Sync Products"**
4. Wait for confirmation
5. Review synced products with markup pricing

Products will be automatically priced based on the markup percentage.

## Step 5: Generate API Keys

1. Click the **"API Keys"** tab
2. Click **"Create API Key"**
3. Enter key name (e.g., "Integration API Key")
4. Configure permissions:
   - ✓ Read Products
   - ☐ Write Products
   - ✓ Read Customers
   - ☐ Write Customers
   - ✓ Read Orders
   - ☐ Write Orders
   - ☐ Manage Agents
5. Copy and securely store the API key (shown only once!)
6. Share key with reseller for integrations

## Step 6: Activate Tenant

1. Return to **"General"** tab
2. Change status from "Pending Setup" to "Active"
3. Click **"Save Changes"**

The tenant is now live!

## Step 7: Access Tenant Portal

The reseller can now access their white-label portal at:
```
https://[subdomain].audico-platform.com
```

For example: `https://acme.audico-platform.com`

## Step 8: Configure Custom Domain (Optional)

1. In **"General"** tab, enter custom domain (e.g., "platform.acme.com")
2. Provide reseller with CNAME record:
   ```
   Type: CNAME
   Name: platform (or subdomain)
   Value: [subdomain].audico-platform.com
   ```
3. Wait for DNS propagation
4. Verify domain ownership (implementation specific)
5. Enable custom domain

## Testing the Tenant

### Test Portal Access

1. Open tenant URL in incognito window
2. Verify branding appears correctly
3. Check all enabled features are accessible
4. Confirm products display with correct pricing

### Test API Integration

```bash
# List products
curl -X GET "https://audico-platform.com/api/v1/products" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Create customer
curl -X POST "https://audico-platform.com/api/v1/customers" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUST-001",
    "full_name": "John Doe",
    "email": "john@example.com",
    "company_name": "Test Company"
  }'

# Create order
curl -X POST "https://audico-platform.com/api/v1/orders" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUSTOMER_UUID",
    "subtotal": 1000,
    "tax": 150,
    "shipping": 50,
    "total": 1200,
    "items": [
      {
        "product_id": "PRODUCT_UUID",
        "quantity": 2,
        "unit_price": 500,
        "total": 1000
      }
    ]
  }'
```

## Monitoring

### Usage Tracking

1. Click the **"Usage"** tab
2. Review daily metrics:
   - API calls
   - Agent actions
   - Orders processed
   - Customers managed
   - Estimated costs

### Audit Log

1. View audit log in tenant detail
2. Monitor all API requests
3. Track resource access
4. Ensure security compliance

## Common Tasks

### Update Markup Pricing

1. Go to **"General"** tab
2. Update "Product Markup %"
3. Save changes
4. Re-sync products to apply new pricing

### Suspend Tenant

1. Go to **"General"** tab
2. Change status to "Suspended"
3. Tenant portal becomes inaccessible
4. API keys are disabled

### Reactivate Tenant

1. Change status back to "Active"
2. Portal and API access restored

### Revoke API Key

1. Go to **"API Keys"** tab
2. Find the key to revoke
3. Set "is_active" to false (or delete)

## Best Practices

### Security

- Generate separate API keys for different integrations
- Use read-only keys when write access not needed
- Rotate API keys regularly (quarterly)
- Monitor usage for unusual patterns
- Enable audit logging

### Pricing

- Set competitive but profitable markup percentages
- Review market pricing regularly
- Consider volume discounts for large tenants
- Track cost metrics for profitability

### Onboarding

- Provide tenant with documentation
- Share API integration guide
- Schedule training session
- Set up support channel
- Monitor first week usage closely

### Maintenance

- Review usage metrics weekly
- Check for errors in audit logs
- Update product catalog monthly
- Sync new products to active tenants
- Collect feedback from resellers

## Troubleshooting

### Tenant Can't Access Portal

- Check tenant status is "Active"
- Verify subdomain is correct
- Test DNS resolution
- Clear browser cache
- Check for network issues

### Products Not Showing

- Ensure products were synced
- Check product visibility flags
- Verify category assignments
- Review markup calculation
- Check stock availability

### API Key Not Working

- Verify key is active
- Check permissions for operation
- Ensure key hasn't expired
- Validate key format in request
- Review rate limits

### Branding Not Applied

- Clear browser cache
- Verify URLs are accessible
- Check color format (hex)
- Test in different browser
- Review CSS loading

## Next Steps

After setting up a tenant:

1. **Set Up Agents**: Configure dedicated agent instances
2. **Import Customers**: Bulk import existing customer data
3. **Configure Territories**: Set up geographic restrictions
4. **Enable Integrations**: Connect to reseller's systems
5. **Train Users**: Provide onboarding and training
6. **Monitor Performance**: Track usage and optimize

## Support

For issues or questions:
- Review WHITE_LABEL_MULTI_TENANT.md for detailed documentation
- Check tenant audit logs for errors
- Contact platform support
- Review API documentation

## API Integration Examples

### Node.js Example

```javascript
const TENANT_API_KEY = 'your_api_key_here'
const BASE_URL = 'https://audico-platform.com/api/v1'

async function getProducts() {
  const response = await fetch(`${BASE_URL}/products`, {
    headers: {
      'Authorization': `Bearer ${TENANT_API_KEY}`,
      'Content-Type': 'application/json'
    }
  })
  return response.json()
}

async function createOrder(orderData) {
  const response = await fetch(`${BASE_URL}/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TENANT_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(orderData)
  })
  return response.json()
}
```

### Python Example

```python
import requests

TENANT_API_KEY = 'your_api_key_here'
BASE_URL = 'https://audico-platform.com/api/v1'

def get_products():
    headers = {
        'Authorization': f'Bearer {TENANT_API_KEY}',
        'Content-Type': 'application/json'
    }
    response = requests.get(f'{BASE_URL}/products', headers=headers)
    return response.json()

def create_customer(customer_data):
    headers = {
        'Authorization': f'Bearer {TENANT_API_KEY}',
        'Content-Type': 'application/json'
    }
    response = requests.post(
        f'{BASE_URL}/customers',
        headers=headers,
        json=customer_data
    )
    return response.json()
```

## Conclusion

You now have a fully functional white-label tenant! The reseller can start using their branded Mission Control platform immediately.

For advanced configuration and features, refer to the complete WHITE_LABEL_MULTI_TENANT.md documentation.
