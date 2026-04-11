#!/bin/bash
# Deploy the /apply NLG intake form to production
cd "$(dirname "$0")"
echo "🚀 Deploying to innercirclelink.com..."
vercel --prod
echo "✅ Done! Check innercirclelink.com/apply"
