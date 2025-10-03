'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Bug } from 'lucide-react';

interface Document {
  id: string | number;
  doc_id?: string;
  title: string;
  filename: string;
  chunk_count: number;
  created_at: string;
  updated_at?: string;
}

interface DocumentDebugInfoProps {
  document: Document | null;
  isLoading: boolean;
  onRefresh?: () => void;
  className?: string;
}

export function DocumentDebugInfo({ 
  document, 
  isLoading, 
  onRefresh,
  className = '' 
}: DocumentDebugInfoProps) {
  if (!document && !isLoading) {
    return null;
  }

  return (
    <Card className={`border-dashed border-orange-200 bg-orange-50 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center space-x-2">
          <Bug className="h-4 w-4 text-orange-600" />
          <span>Debug Info</span>
          <Badge variant="outline" className="text-xs">
            Development Only
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="text-sm text-orange-700">Loading document...</div>
        ) : document ? (
          <div className="space-y-2 text-xs font-mono">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-orange-600">ID:</span>
                <div className="text-orange-800">{document.id}</div>
              </div>
              <div>
                <span className="text-orange-600">Doc ID:</span>
                <div className="text-orange-800">{document.doc_id || 'N/A'}</div>
              </div>
              <div>
                <span className="text-orange-600">Chunks:</span>
                <div className="text-orange-800 font-bold">{document.chunk_count}</div>
              </div>
              <div>
                <span className="text-orange-600">Created:</span>
                <div className="text-orange-800">
                  {new Date(document.created_at).toLocaleTimeString()}
                </div>
              </div>
            </div>
            
            <div>
              <span className="text-orange-600">Title:</span>
              <div className="text-orange-800 break-all">
                {document.title || document.filename}
              </div>
            </div>
            
            {document.updated_at && (
              <div>
                <span className="text-orange-600">Updated:</span>
                <div className="text-orange-800">
                  {new Date(document.updated_at).toLocaleTimeString()}
                </div>
              </div>
            )}
            
            <div>
              <span className="text-orange-600">Last Refresh:</span>
              <div className="text-orange-800">
                {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-orange-700">No document data</div>
        )}
        
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="w-full text-orange-700 border-orange-300 hover:bg-orange-100"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Force Refresh
          </Button>
        )}
        
        <div className="text-xs text-orange-600 italic">
          This debug panel shows real-time document data. If chunk_count is 0 but the document is uploaded, 
          there may be a polling or caching issue.
        </div>
      </CardContent>
    </Card>
  );
}

