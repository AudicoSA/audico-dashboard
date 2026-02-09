# Tenant API Documentation

## Overview

The Tenant API allows white-label resellers to integrate Mission Control with their existing systems. All API endpoints require authentication using a tenant-specific API key.

## Base URL

```
https://audico-platform.com/api/v1
```

## Authentication

All API requests must include an API key in the Authorization header:

```
Authorization: Bearer YOUR_API_KEY
```

### Obtaining an API Key

Contact your platform administrator to generate an API key for your tenant. API keys can be managed from your Settings page.

### Security Best Practices

- Store API keys securely (environment variables, secret management)
- Never commit API keys to version control
- Use separate keys for different environments (dev, staging, production)
- Rotate keys regularly (recommended quarterly)
- Use read-only keys when write access is not needed

## Rate Limiting

API requests are rate-limited per API key:
- Default: 60 requests per minute
- Enterprise: Custom limits available

Rate limit headers are included in all responses:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1234567890
```

## Response Format

All responses are in JSON format with standard structure:

### Success Response
```json
{
  "data": [...],
  "meta": {
    "count": 10,
    "page": 1,
    "total": 100
  }
}
```

### Error Response
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

## HTTP Status Codes

- `200 OK` - Request succeeded
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Missing or invalid API key
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

## Endpoints

### Products

#### List Products

```http
GET /api/v1/products
```

Returns all visible and available products for your tenant.

**Query Parameters:**
- `category` (optional) - Filter by category

**Required Permission:** `read_products`

**Example Request:**
```bash
curl -X GET "https://audico-platform.com/api/v1/products?category=Smart%20Speakers" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Example Response:**
```json
{
  "products": [
    {
      "id": "uuid",
      "product_id": "uuid",
      "name": "Sonos One SL",
      "description": "Compact smart speaker with rich, room-filling sound.",
      "category": "Smart Speakers",
      "brand": "Sonos",
      "sku": "SONOS-ONE-SL",
      "image_url": "https://...",
      "features": ["WiFi Connectivity", "Multi-room Audio"],
      "tags": ["smart home", "smart speakers"],
      "price": 4598.85,
      "currency": "ZAR"
    }
  ]
}
```

---

### Customers

#### List Customers

```http
GET /api/v1/customers
```

Returns all customers for your tenant.

**Query Parameters:**
- `status` (optional) - Filter by status: `active`, `inactive`, `blocked`

**Required Permission:** `read_customers`

**Example Request:**
```bash
curl -X GET "https://audico-platform.com/api/v1/customers?status=active" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Example Response:**
```json
{
  "customers": [
    {
      "id": "uuid",
      "customer_id": "CUST-001",
      "full_name": "John Doe",
      "email": "john@example.com",
      "phone": "+27123456789",
      "company_name": "Acme Corp",
      "territory": "Western Cape",
      "status": "active",
      "total_orders": 5,
      "total_spent": 15000.00,
      "last_order_date": "2024-02-01T10:00:00Z",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### Create Customer

```http
POST /api/v1/customers
```

Creates a new customer in your tenant.

**Required Permission:** `write_customers`

**Request Body:**
```json
{
  "customer_id": "CUST-002",
  "full_name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "+27987654321",
  "company_name": "Tech Solutions",
  "territory": "Gauteng"
}
```

**Example Request:**
```bash
curl -X POST "https://audico-platform.com/api/v1/customers" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUST-002",
    "full_name": "Jane Smith",
    "email": "jane@example.com"
  }'
```

**Example Response:**
```json
{
  "customer": {
    "id": "uuid",
    "customer_id": "CUST-002",
    "full_name": "Jane Smith",
    "email": "jane@example.com",
    "status": "active",
    "created_at": "2024-02-09T12:00:00Z"
  }
}
```

---

### Orders

#### List Orders

```http
GET /api/v1/orders
```

Returns all orders for your tenant.

**Query Parameters:**
- `status` (optional) - Filter by status: `pending`, `processing`, `completed`, `cancelled`, `refunded`

**Required Permission:** `read_orders`

**Example Request:**
```bash
curl -X GET "https://audico-platform.com/api/v1/orders?status=completed" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Example Response:**
```json
{
  "orders": [
    {
      "id": "uuid",
      "order_number": "ORD-1707481200000-ABC123",
      "customer_id": "uuid",
      "order_date": "2024-02-09T10:00:00Z",
      "status": "completed",
      "subtotal": 4000.00,
      "tax": 600.00,
      "shipping": 100.00,
      "total": 4700.00,
      "currency": "ZAR",
      "items": [
        {
          "product_id": "uuid",
          "product_name": "Sonos One SL",
          "quantity": 1,
          "unit_price": 4000.00,
          "total": 4000.00
        }
      ],
      "fulfillment_status": "fulfilled",
      "tracking_number": "TRK123456",
      "shipped_at": "2024-02-10T08:00:00Z",
      "delivered_at": "2024-02-12T14:30:00Z"
    }
  ]
}
```

#### Create Order

```http
POST /api/v1/orders
```

Creates a new order in your tenant.

**Required Permission:** `write_orders`

**Request Body:**
```json
{
  "customer_id": "uuid",
  "subtotal": 4000.00,
  "tax": 600.00,
  "shipping": 100.00,
  "total": 4700.00,
  "currency": "ZAR",
  "items": [
    {
      "product_id": "uuid",
      "quantity": 1,
      "unit_price": 4000.00,
      "total": 4000.00
    }
  ],
  "shipping_address": {
    "street": "123 Main St",
    "city": "Cape Town",
    "province": "Western Cape",
    "postal_code": "8001",
    "country": "South Africa"
  },
  "billing_address": {
    "street": "123 Main St",
    "city": "Cape Town",
    "province": "Western Cape",
    "postal_code": "8001",
    "country": "South Africa"
  }
}
```

**Example Request:**
```bash
curl -X POST "https://audico-platform.com/api/v1/orders" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "uuid",
    "subtotal": 4000.00,
    "tax": 600.00,
    "shipping": 100.00,
    "total": 4700.00,
    "items": [
      {
        "product_id": "uuid",
        "quantity": 1,
        "unit_price": 4000.00,
        "total": 4000.00
      }
    ]
  }'
```

**Example Response:**
```json
{
  "order": {
    "id": "uuid",
    "order_number": "ORD-1707481200000-XYZ789",
    "customer_id": "uuid",
    "status": "pending",
    "total": 4700.00,
    "created_at": "2024-02-09T12:00:00Z"
  }
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_API_KEY` | API key is missing or invalid |
| `PERMISSION_DENIED` | API key lacks required permission |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `RESOURCE_NOT_FOUND` | Requested resource doesn't exist |
| `VALIDATION_ERROR` | Request validation failed |
| `DUPLICATE_RESOURCE` | Resource already exists |
| `INTERNAL_ERROR` | Server error occurred |

## Webhooks (Coming Soon)

Future support for webhooks to receive real-time notifications:
- Order created
- Order status changed
- Customer created
- Product updated

## SDK Libraries (Coming Soon)

Official SDK libraries will be available for:
- Node.js / TypeScript
- Python
- PHP
- Ruby
- C# / .NET

## Support

For API support:
- Documentation: Review this guide
- API Status: Check platform status page
- Contact: support@audico-platform.com
- Community: Developer forum (coming soon)

## Changelog

### Version 1.0 (Current)
- Initial release
- Products API
- Customers API
- Orders API
- API key authentication
- Rate limiting

## Terms of Service

By using the Tenant API, you agree to:
- Use the API only for authorized purposes
- Protect your API keys
- Respect rate limits
- Comply with data protection regulations
- Maintain security best practices

Unauthorized use may result in API access suspension.
