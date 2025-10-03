#!/bin/bash

echo "🚀 Setting up PdfUploader component..."

# Install required dependencies
echo "📦 Installing dependencies..."
npm install pdfjs-dist @types/pdfjs-dist

# Install shadcn/ui components if not already installed
echo "🎨 Installing UI components..."
npx shadcn-ui@latest add button card progress badge --yes

# Create next.config.js if it doesn't exist
if [ ! -f "next.config.js" ]; then
    echo "⚙️ Creating next.config.js..."
    cat > next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
};

module.exports = nextConfig;
EOF
else
    echo "⚠️ next.config.js already exists. Please add PDF.js webpack config manually."
fi

# Create example usage file
echo "📝 Creating example usage file..."
cat > app/upload-example/page.tsx << 'EOF'
'use client';

import { PdfUploaderExample } from '@/components/PdfUploaderExample';

export default function UploadExamplePage() {
  return (
    <div className="container mx-auto py-8">
      <PdfUploaderExample />
    </div>
  );
}
EOF

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Ensure your API endpoints are configured:"
echo "   - POST /api/documents/upload"
echo "   - GET /api/documents/{doc_id}"
echo ""
echo "2. Configure authentication headers in your axios setup"
echo ""
echo "3. Test the component at /upload-example"
echo ""
echo "4. Read PDFUPLOADER_README.md for detailed usage instructions"

