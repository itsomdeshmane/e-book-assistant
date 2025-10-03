'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { FileText, LogOut, Users, Clock } from 'lucide-react';
import Link from 'next/link';

export function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();

  return (
    <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <FileText className="h-6 w-6 text-blue-600" />
              <span className="text-xl font-semibold text-gray-900">DocChat</span>
            </Link>
          </div>

          {isAuthenticated && user && (
            <div className="flex items-center space-x-4">
              <Link href="/interview-questions" className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                <Users className="h-4 w-4" />

                <span>Interview Questions</span>
              </Link>
              <Link href="/interview-history" className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                <Clock className="h-4 w-4" />
                <span>History</span>
              </Link>
              <span className="text-sm text-gray-600">
                Welcome, <span className="font-medium text-gray-900">{user.name}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-gray-600 hover:text-gray-900"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}