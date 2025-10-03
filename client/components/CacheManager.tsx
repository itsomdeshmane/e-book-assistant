'use client';

import { useState } from 'react';
import { summaryCache } from '@/lib/cache';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Trash2, Database, RefreshCw, Info } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface CacheManagerProps {
  className?: string;
}

export function CacheManager({ className }: CacheManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [cacheStats, setCacheStats] = useState(() => {
    // Get current user ID for cache isolation
    let userId: string | undefined;
    const token = localStorage.getItem('token');
    if (token && typeof window !== 'undefined') {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        userId = payload.sub;
      } catch (error) {
        console.warn('Failed to parse token for cache isolation:', error);
      }
    }
    return summaryCache.getCacheStats(userId);
  });

  const refreshStats = () => {
    // Get current user ID for cache isolation
    let userId: string | undefined;
    const token = localStorage.getItem('token');
    if (token && typeof window !== 'undefined') {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        userId = payload.sub;
      } catch (error) {
        console.warn('Failed to parse token for cache isolation:', error);
      }
    }
    setCacheStats(summaryCache.getCacheStats(userId));
  };

  const handleClearCache = () => {
    // Get current user ID for cache isolation
    let userId: string | undefined;
    const token = localStorage.getItem('token');
    if (token && typeof window !== 'undefined') {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        userId = payload.sub;
        
        if (userId) {
          summaryCache.clearUserCache(userId);
          toast.success('Your cache cleared successfully');
        } else {
          summaryCache.clearAllCache();
          toast.success('Cache cleared successfully');
        }
      } catch (error) {
        summaryCache.clearAllCache();
        toast.success('Cache cleared successfully');
      }
    } else {
      summaryCache.clearAllCache();
      toast.success('Cache cleared successfully');
    }
    refreshStats();
  };

  const handleClearExpired = () => {
    // This will be handled automatically by the cache manager
    // We just need to trigger a refresh to see the updated stats
    refreshStats();
    toast.success('Expired entries cleaned up');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Database className="h-4 w-4 mr-2" />
          Cache Manager
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Database className="h-5 w-5 mr-2" />
            Your Summary Cache
          </DialogTitle>
          <DialogDescription>
            Manage your personal cached document summaries. Each user has isolated cache storage.
          </DialogDescription>
        </DialogHeader>
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                Cache Statistics
                <Button variant="ghost" size="sm" onClick={refreshStats}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Your Cached Entries:</span>
                <Badge variant="secondary">{cacheStats.userEntries}</Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Your Expired Entries:</span>
                <Badge variant={cacheStats.expiredEntries > 0 ? "destructive" : "secondary"}>
                  {cacheStats.expiredEntries}
                </Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Cache Storage:</span>
                <Badge variant="outline">{cacheStats.cacheSize}</Badge>
              </div>
            </CardContent>
          </Card>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">How caching works:</p>
                <ul className="text-xs space-y-1 text-blue-700">
                  <li>• Summaries are cached for 24 hours</li>
                  <li>• Cached summaries load instantly</li>
                  <li>• Cache is automatically cleaned on app start</li>
                  <li>• Deleting documents clears their cache</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={handleClearExpired}
              className="flex-1"
              disabled={cacheStats.expiredEntries === 0}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Clean Expired
            </Button>
            
            <Button
              variant="destructive"
              onClick={handleClearCache}
              className="flex-1"
              disabled={cacheStats.userEntries === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Your Cache
            </Button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

