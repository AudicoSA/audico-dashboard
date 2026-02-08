# Social Media Integration Setup

This guide explains how to set up and use the social media integration features in the Audico Dashboard.

## Features

- **Facebook Graph API** - Post to Facebook pages with text, images, and multiple photos
- **Instagram Graph API** - Post to Instagram Business accounts with images, videos, and carousels
- **Twitter/X API v2** - Post tweets with text and media
- **OAuth2 Setup Wizard** - Easy connection flow for all platforms
- **Account Management** - Connect/disconnect multiple accounts per platform

## Database Setup

Create the following tables in your Supabase database:

### social_accounts Table

```sql
CREATE TABLE social_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('facebook', 'instagram', 'twitter')),
  account_id VARCHAR(255) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, account_id)
);

CREATE INDEX idx_social_accounts_platform ON social_accounts(platform);
```

### oauth_temp_tokens Table (for Twitter OAuth)

```sql
CREATE TABLE oauth_temp_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  oauth_token VARCHAR(255) NOT NULL,
  oauth_token_secret VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(oauth_token)
);

CREATE INDEX idx_oauth_temp_tokens_token ON oauth_temp_tokens(oauth_token);
CREATE INDEX idx_oauth_temp_tokens_created ON oauth_temp_tokens(created_at);
```

### Cleanup old OAuth tokens (run periodically)

```sql
DELETE FROM oauth_temp_tokens WHERE created_at < NOW() - INTERVAL '1 hour';
```

## Environment Variables

Add the following to your `.env.local` file:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# App URL (for OAuth redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3001

# Facebook OAuth (for both Facebook and Instagram)
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret

# Twitter OAuth
TWITTER_CONSUMER_KEY=your_twitter_consumer_key
TWITTER_CONSUMER_SECRET=your_twitter_consumer_secret
```

## Platform Setup

### Facebook Setup

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app or use existing one
3. Add "Facebook Login" product
4. Configure OAuth redirect URIs:
   - `http://localhost:3001/api/social/oauth/facebook` (development)
   - `https://yourdomain.com/api/social/oauth/facebook` (production)
5. Request permissions: `pages_manage_posts`, `pages_read_engagement`
6. Copy App ID and App Secret to environment variables

### Instagram Setup

Instagram uses Facebook's Graph API, so use the same Facebook app:

1. Ensure your Facebook app has Instagram permissions
2. Link your Instagram Business account to a Facebook page
3. Request additional permissions: `instagram_basic`, `instagram_content_publish`
4. Configure the same OAuth redirect URI as Facebook:
   - `http://localhost:3001/api/social/oauth/instagram`

### Twitter Setup

1. Go to [Twitter Developer Portal](https://developer.twitter.com/)
2. Create a new app or use existing one
3. Enable OAuth 1.0a
4. Configure callback URL:
   - `http://localhost:3001/api/social/oauth/twitter` (development)
   - `https://yourdomain.com/api/social/oauth/twitter` (production)
5. Request permissions: Read and Write
6. Copy API Key (Consumer Key) and API Secret (Consumer Secret) to environment variables

## Usage

### Connecting Accounts

1. Navigate to `/social` in the dashboard
2. Click "Connect" on any platform card
3. Follow the OAuth flow
4. For Facebook/Instagram: Select which page/account to connect
5. For Twitter: Authorize the app

### Publishing Posts

Use the API endpoint `/api/agents/social/post`:

```typescript
// POST /api/agents/social/post
{
  "post_id": "uuid-of-social-post-in-database",
  "platforms": ["facebook", "instagram", "twitter"]
}
```

The endpoint will:
1. Fetch the post from `social_posts` table
2. Get connected accounts for specified platforms
3. Post to each platform using their respective APIs
4. Update post status and metadata
5. Return results for each platform

### Example: Creating and Publishing a Post

```typescript
// 1. Create a post in social_posts table
const post = await supabase.from('social_posts').insert({
  content: "Check out our new product! #awesome",
  media_urls: ["https://example.com/image.jpg"],
  status: "draft",
  platform: "facebook" // or use multi-platform
})

// 2. Publish via API
const response = await fetch('/api/agents/social/post', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    post_id: post.id,
    platforms: ['facebook', 'instagram', 'twitter']
  })
})

const result = await response.json()
// result: { success: true, published: 2, failed: 0, results: [...] }
```

## API Reference

### Social Connectors (`lib/social-connectors.ts`)

#### FacebookConnector

```typescript
const connector = new FacebookConnector(accessToken, pageId)
await connector.post(content, mediaUrls)
await connector.verifyToken()
```

#### InstagramConnector

```typescript
const connector = new InstagramConnector(accessToken, instagramAccountId)
await connector.post(content, mediaUrls) // Requires at least 1 media
await connector.verifyToken()
```

#### TwitterConnector

```typescript
const connector = new TwitterConnector(
  accessToken,
  accessTokenSecret,
  consumerKey,
  consumerSecret
)
await connector.post(content, mediaUrls)
await connector.verifyToken()
```

### API Endpoints

- `GET /api/social/accounts` - List all connected accounts
- `POST /api/social/accounts` - Add a new account (used by OAuth flow)
- `DELETE /api/social/accounts?id={id}` - Disconnect an account
- `GET /api/social/oauth/facebook` - Facebook OAuth flow
- `GET /api/social/oauth/instagram` - Instagram OAuth flow
- `GET /api/social/oauth/twitter` - Twitter OAuth flow
- `POST /api/agents/social/post` - Publish content to platforms
- `GET /api/agents/social/post` - List social posts

## Platform-Specific Notes

### Facebook
- Supports text-only posts, single images, or multiple images (up to 10)
- Page access token required (obtained via OAuth)
- Posts appear on the connected Facebook page

### Instagram
- **Requires at least one image or video**
- Supports single media or carousel (multiple images)
- Must be linked to Instagram Business account
- Videos must be publicly accessible URLs

### Twitter
- Supports up to 4 images per tweet
- Character limit: 280 characters (enforced by Twitter API)
- Media is uploaded before posting the tweet

## Troubleshooting

### "No connected accounts found"
- Make sure you've connected at least one account via `/social`
- Check that the platform is properly connected in the database

### "Token expired or invalid"
- Reconnect the account through the OAuth flow
- Facebook/Instagram tokens typically last 60 days
- Twitter tokens don't expire unless revoked

### Instagram: "No Instagram Business accounts found"
- Instagram personal accounts don't work - must be Business/Creator account
- Link your Instagram account to a Facebook page first
- Convert to Business account in Instagram settings

### Twitter: "Failed to get request token"
- Verify Consumer Key and Consumer Secret in environment variables
- Check that OAuth 1.0a is enabled in Twitter Developer Portal
- Ensure callback URL matches exactly (including http/https)

## Security Best Practices

1. **Never commit tokens to git** - Use environment variables
2. **Use service role key server-side only** - Never expose to client
3. **Implement rate limiting** - Prevent API abuse
4. **Validate post content** - Sanitize user input before posting
5. **Monitor token expiry** - Refresh tokens before they expire
6. **Use HTTPS in production** - Secure OAuth callbacks

## Next Steps

- Add scheduled posting functionality
- Implement post analytics and engagement tracking
- Add support for LinkedIn, TikTok, YouTube
- Create post templates and content calendar
- Add AI-powered content suggestions
