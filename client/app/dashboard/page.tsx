'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Navbar } from '@/components/Navbar';
import { FileUploader } from '@/components/FileUploader';
import { CacheManager } from '@/components/CacheManager';
import { useDocuments, useDeleteDocument, useMe } from '@/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Trash2, FileText, Upload, Users, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useState } from 'react';

function DashboardContent() {
  const router = useRouter();
  const { data: currentUser } = useMe();
  const { data: documents, isLoading, refetch } = useDocuments(currentUser?.id);
  const deleteMutation = useDeleteDocument();
  const [showUploader, setShowUploader] = useState(false);

  const handleDelete = async (docId: string) => {
    try {
      await deleteMutation.mutateAsync(docId);
      toast.success('Document deleted successfully');
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  const handleUploadComplete = () => {
    setShowUploader(false);
    refetch();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Document Dashboard</h1>
            <p className="text-gray-600 mt-1">Upload, chat, and generate interview questions from your PDF documents</p>
          </div>
          <div className="flex space-x-3">
            <Button 
              onClick={() => router.push('/interview-questions')} 
              variant="outline"
              size="lg"
            >
              <Users className="h-5 w-5 mr-2" />
              Interview Questions
            </Button>
            <CacheManager />
            <Button onClick={() => setShowUploader(!showUploader)} size="lg">
              <Upload className="h-5 w-5 mr-2" />
              Upload PDF
            </Button>
          </div>
        </div>

        {showUploader && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card>
              <CardHeader>
                <CardTitle>Upload Document</CardTitle>
                <CardDescription>Select a PDF file to upload and analyze</CardDescription>
              </CardHeader>
              <CardContent>
                <FileUploader onUploadComplete={handleUploadComplete} />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <HelpCircle className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Interview Questions</CardTitle>
                  <CardDescription>Generate AI-powered questions</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => router.push('/interview-questions')} 
                className="w-full"
                variant="outline"
              >
                <Users className="h-4 w-4 mr-2" />
                Generate Questions
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="bg-green-100 p-2 rounded-lg">
                  <MessageSquare className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Document Chat</CardTitle>
                  <CardDescription>Chat with your documents</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button 
                disabled
                className="w-full"
                variant="outline"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Select Document Below
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="bg-purple-100 p-2 rounded-lg">
                  <FileText className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Upload Documents</CardTitle>
                  <CardDescription>Add PDF files to analyze</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => setShowUploader(!showUploader)}
                className="w-full"
                variant="outline"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload PDF
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Your Documents</h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : documents && documents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((doc, index) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                          <FileText className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg truncate">
                            {doc.title || doc.filename}
                          </CardTitle>
                          <CardDescription>
                            {format(new Date(doc.created_at), 'MMM d, yyyy')}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 mt-2">
                      {doc.chunk_count} chunks
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      onClick={() => router.push(`/chat/${String(doc.doc_id ?? doc.id)}`)}
                      className="w-full"
                      variant="default"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Open Chat
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="w-full text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete "{doc.title || doc.filename}". This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(String(doc.doc_id ?? doc.id))}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No documents yet</h3>
              <p className="text-gray-500 mb-6">Upload your first PDF to get started</p>
              <Button onClick={() => setShowUploader(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload PDF
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}