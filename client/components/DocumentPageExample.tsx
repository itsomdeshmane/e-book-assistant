'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Eye, Edit3 } from 'lucide-react';

export function DocumentPageExample() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Document Detail Page Example</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600">
            The document detail page provides comprehensive document analysis and OCR review capabilities.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center">
                <FileText className="h-4 w-4 mr-2" />
                Document Status
              </h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Real-time processing status</li>
                <li>• Chunk count tracking</li>
                <li>• Exponential backoff polling</li>
                <li>• Progress indicators</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center">
                <Eye className="h-4 w-4 mr-2" />
                Page Analysis
              </h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Page-by-page metadata</li>
                <li>• OCR confidence scores</li>
                <li>• Text snippets preview</li>
                <li>• Image thumbnails</li>
              </ul>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold flex items-center">
              <Edit3 className="h-4 w-4 mr-2" />
              OCR Review Features
            </h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Interactive text correction modal</li>
              <li>• Side-by-side image and text view</li>
              <li>• Zoom and navigation controls</li>
              <li>• Confidence-based review suggestions</li>
              <li>• Notes and correction tracking</li>
            </ul>
          </div>

          <div className="pt-4 border-t">
            <h4 className="font-medium mb-2">Example URLs:</h4>
            <div className="space-y-2 text-sm">
              <div className="font-mono bg-gray-100 p-2 rounded">
                /pages/doc/[docId] → Document detail page
              </div>
              <div className="font-mono bg-gray-100 p-2 rounded">
                GET /api/documents/{docId} → Document status
              </div>
              <div className="font-mono bg-gray-100 p-2 rounded">
                GET /api/documents/debug/{docId} → Page metadata
              </div>
              <div className="font-mono bg-gray-100 p-2 rounded">
                POST /api/documents/{docId}/ocr-correct → Save corrections
              </div>
            </div>
          </div>

          <div className="flex space-x-2 pt-4">
            <Button asChild>
              <Link href="/doc/example-doc-id">
                View Example Document
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard">
                Back to Dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

