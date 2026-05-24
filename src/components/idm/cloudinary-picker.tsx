'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
// framer-motion removed — using CSS stagger-item classes
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Image as ImageIcon,
  Loader2,
  FolderOpen,
  ChevronRight,
  X,
  Check,
  RefreshCw,
  Upload,
  Cloud,
  Camera,
} from 'lucide-react';
import { toast } from 'sonner';
import { getOptimizedCloudinaryUrl } from '@/lib/utils';
import { compressImage, shouldCompress } from '@/lib/image-compress';

interface CloudinaryImage {
  public_id: string;
  url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  created_at: string;
  resourceType?: string;
  duration?: number;
}

interface CloudinaryPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string, publicId: string) => void;
  currentImage?: string | null;
  /** Default folder for uploads (e.g., "avatars") */
  uploadFolder?: string;
}

/** Threshold: if file > 3MB, use signed upload (direct to Cloudinary) to bypass Vercel 4.5MB limit */
const SIGNED_UPLOAD_THRESHOLD = 3 * 1024 * 1024;

export function CloudinaryPicker({ open, onClose, onSelect, currentImage, uploadFolder = 'avatars' }: CloudinaryPickerProps) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<CloudinaryImage | null>(null);
  const [currentFolder, setCurrentFolder] = useState('');
  const [folders, setFolders] = useState<{ name: string; path: string }[]>([]);

  // Upload state
  const [uploadTab, setUploadTab] = useState<'browse' | 'upload'>('browse');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadFolderInput, setUploadFolderInput] = useState(uploadFolder);
  const [uploadPublicId, setUploadPublicId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Fetch images from Cloudinary
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['cloudinary-images', currentFolder],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('max_results', '100');
      if (currentFolder) {
        params.append('prefix', currentFolder);
      }
      const res = await fetch(`/api/cloudinary/images?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch images');
      return res.json();
    },
    enabled: open,
  });

  // Fetch folders
  useEffect(() => {
    if (open) {
      fetch('/api/cloudinary/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'get_folders' }),
      })
        .then(res => res.json())
        .then(data => setFolders(data.folders || []))
        .catch(console.error);
    }
  }, [open]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedImage(null);
      setSearchQuery('');
      setUploadFile(null);
      setUploadPreview(null);
      setUploadPublicId('');
      setUploadFolderInput(uploadFolder);
      setUploadTab('browse');
    }
  }, [open, uploadFolder]);

  // Filter images by search
  const filteredImages = (data?.images || []).filter((img: CloudinaryImage) =>
    img.public_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = () => {
    if (selectedImage) {
      onSelect(selectedImage.url, selectedImage.public_id);
      handleClose();
    }
  };

  const handleClose = () => {
    onClose();
    setSelectedImage(null);
    setSearchQuery('');
    setUploadFile(null);
    setUploadPreview(null);
  };

  // File handling — with client-side compression for images
  const handleFileChange = useCallback(async (file: File) => {
    // Validate file type — support both image and video
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      toast.error('Hanya file gambar atau video yang diperbolehkan');
      return;
    }
    // Validate file size (max 50MB for video, 10MB for image)
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(isVideo ? 'Ukuran video maksimal 50MB' : 'Ukuran gambar maksimal 10MB');
      return;
    }

    setUploadFile(file);
    // Auto-generate publicId from filename
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    setUploadPublicId(nameWithoutExt);

    if (isImage) {
      // ★ Compress image before creating preview to reduce base64 size
      setIsCompressing(true);
      try {
        const compressed = await compressImage(file, {
          maxWidth: 1920,
          maxHeight: 1920,
          quality: 0.8,
          maxOutputBytes: 3 * 1024 * 1024, // target under 3MB before base64
        });
        setUploadPreview(compressed);
      } catch {
        // Fallback: use original as preview (might still 413 on very large files)
        const reader = new FileReader();
        reader.onloadend = () => {
          setUploadPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } finally {
        setIsCompressing(false);
      }
    } else {
      // Video: just create a preview for display (will use signed upload later)
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileChange(file);
  };

  // Drag & Drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) handleFileChange(file);
  }, [handleFileChange]);

  /**
   * ★ Signed upload: upload directly from client to Cloudinary
   * Bypasses Vercel's serverless function body size limit entirely.
   */
  const uploadViaSignedUrl = async (): Promise<{ url: string; publicId: string }> => {
    if (!uploadFile) throw new Error('No file selected');

    const isVideo = uploadFile.type.startsWith('video/');
    const resourceType = isVideo ? 'video' : 'image';

    // Step 1: Get signed upload params from our server
    const signRes = await fetch('/api/cloudinary/sign-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        folder: uploadFolderInput || uploadFolder,
        publicId: uploadPublicId || undefined,
        resourceType,
      }),
    });

    if (!signRes.ok) {
      const err = await signRes.json();
      throw new Error(err.error || 'Gagal mendapat signature upload');
    }

    const signData = await signRes.json();

    // Step 2: Upload directly to Cloudinary using signed params
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('api_key', signData.apiKey);
    formData.append('timestamp', signData.timestamp.toString());
    formData.append('signature', signData.signature);
    formData.append('folder', signData.folder);
    if (signData.publicId) {
      formData.append('public_id', signData.publicId);
    }

    // Cloudinary upload URL depends on resource type
    const uploadUrl = `https://api.cloudinary.com/v1_1/${signData.cloudName}/${resourceType}/upload`;

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.json();
      throw new Error(err.error?.message || 'Upload ke Cloudinary gagal');
    }

    const result = await uploadRes.json();
    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  };

  // Upload handler — always uses signed upload (direct to Cloudinary, bypasses Vercel limits)
  const handleUpload = async () => {
    if (!uploadFile || !uploadPreview) {
      toast.error('Pilih file terlebih dahulu');
      return;
    }

    setIsUploading(true);
    try {
      // ★ Always use signed upload — bypasses Vercel 4.5MB serverless limit entirely
      const result = await uploadViaSignedUrl();

      toast.success(uploadFile.type.startsWith('video/') ? 'Video berhasil diupload!' : 'Gambar berhasil diupload!');

      // Invalidate the images query to refresh
      qc.invalidateQueries({ queryKey: ['cloudinary-images'] });

      // Auto-select the uploaded image
      onSelect(result.url, result.publicId);
      handleClose();
    } catch (error: any) {
      console.error('[CloudinaryPicker] Upload error:', error);
      toast.error(error.message || 'Upload gagal');
    } finally {
      setIsUploading(false);
    }
  };

  // Clear file
  const clearFile = () => {
    setUploadFile(null);
    setUploadPreview(null);
    setUploadPublicId('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-primary" />
            Cloudinary Media Manager
          </DialogTitle>
        </DialogHeader>

        {/* Tab Switch: Browse / Upload */}
        <Tabs value={uploadTab} onValueChange={(v) => setUploadTab(v as 'browse' | 'upload')} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2 mb-2">
            <TabsTrigger value="browse" className="text-xs">
              <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
              Pilih dari Library
            </TabsTrigger>
            <TabsTrigger value="upload" className="text-xs">
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Upload Baru
            </TabsTrigger>
          </TabsList>

          {/* ===== BROWSE TAB ===== */}
          <TabsContent value="browse" className="flex-1 flex flex-col min-h-0 mt-0">
            {/* Search and folder navigation */}
            <div className="flex items-center gap-2 py-2 border-b">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Cari gambar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading || isRefetching}
              >
                <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {/* Folder breadcrumb */}
            {folders.length > 0 && (
              <div className="flex items-center gap-1 py-2 text-xs overflow-x-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setCurrentFolder('')}
                >
                  <FolderOpen className="w-3 h-3 mr-1" />
                  Root
                </Button>
                {currentFolder && currentFolder.split('/').map((part, i, arr) => (
                  <span key={i} className="flex items-center">
                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setCurrentFolder(arr.slice(0, i + 1).join('/'))}
                    >
                      {part}
                    </Button>
                  </span>
                ))}
              </div>
            )}

            {/* Folder buttons */}
            {folders.length > 0 && !currentFolder && (
              <div className="flex gap-2 py-2 overflow-x-auto">
                {folders.map((folder) => (
                  <Button
                    key={folder.path}
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setCurrentFolder(folder.path)}
                  >
                    <FolderOpen className="w-4 h-4 mr-1.5" />
                    {folder.name}
                  </Button>
                ))}
              </div>
            )}

            {/* Images grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Memuat gambar...</span>
                </div>
              ) : filteredImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                  <p>Tidak ada gambar ditemukan</p>
                  {searchQuery && <p className="text-sm">Coba ubah kata kunci pencarian</p>}
                  {!searchQuery && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => setUploadTab('upload')}
                    >
                      <Upload className="w-4 h-4 mr-1.5" />
                      Upload Gambar Baru
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 p-1">
                    {filteredImages.map((img: CloudinaryImage, i: number) => {
                      const isVideo = img.resourceType === 'video' || img.url.includes('/video/upload/');
                      return (
                      <div
                        key={`${img.public_id}-${i}`}
                        className={`stagger-item-fast relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                          selectedImage?.public_id === img.public_id
                            ? 'border-primary ring-2 ring-primary/30'
                            : 'border-transparent hover:border-primary/50'
                        }`}
                        style={{ animationDelay: `${i * 20}ms` }}
                        onClick={() => setSelectedImage(img)}
                      >
                        {isVideo ? (
                          <video
                            src={img.url}
                            muted
                            className="w-full h-full object-cover"
                            preload="metadata"
                          />
                        ) : (
                          <Image
                            src={getOptimizedCloudinaryUrl(img.url, 300)}
                            alt={img.public_id}
                            fill
                            className="w-full h-full object-cover"
                            sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 20vw"
                            unoptimized
                          />
                        )}
                        {isVideo && (
                          <div className="absolute top-1 left-1 px-1 py-0.5 rounded bg-black/70 text-[8px] text-white font-bold">🎬</div>
                        )}
                        {selectedImage?.public_id === img.public_id && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                              <Check className="w-5 h-5 text-primary-foreground" />
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                          <p className="text-[9px] text-white truncate">{img.public_id.split('/').pop()}</p>
                          <p className="text-[8px] text-white/70">{isVideo ? `🎬 ${img.duration?.toFixed(1) || '?'}s` : `${img.width}x${img.height}`}</p>
                        </div>
                      </div>
                      );
                    })}
                  </div>
              )}
            </div>
          </TabsContent>

          {/* ===== UPLOAD TAB ===== */}
          <TabsContent value="upload" className="flex-1 flex flex-col min-h-0 mt-0 overflow-y-auto">
            <div className="space-y-4 py-2">
              {/* Drop Zone */}
              <div
                className={`relative border-2 border-dashed rounded-2xl p-6 transition-all ${
                  dragActive
                    ? 'border-primary bg-primary/5 scale-[1.02]'
                    : uploadPreview
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                }`}
                onDragEnter={handleDragIn}
                onDragLeave={handleDragOut}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {isCompressing ? (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Mengompres gambar...</p>
                  </div>
                ) : uploadPreview ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative w-40 h-40 rounded-2xl overflow-hidden border-2 border-primary/30 shadow-lg">
                      {uploadFile?.type.startsWith('video/') ? (
                        <video
                          src={uploadPreview}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Image
                          src={uploadPreview}
                          alt="Preview"
                          fill
                          className="w-full h-full object-cover"
                          sizes="160px"
                          unoptimized
                        />
                      )}
                      <button
                        onClick={clearFile}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive flex items-center justify-center hover:bg-destructive/80 transition-colors"
                      >
                        <X className="w-3.5 h-3.5 text-white" />
                      </button>
                      {uploadFile?.type.startsWith('video/') && (
                        <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] text-white font-bold flex items-center gap-1">
                          🎬 VIDEO
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">{uploadFile?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {uploadFile ? (uploadFile.size / 1024 / 1024).toFixed(1) : 0} MB
                        {uploadFile?.type.startsWith('image/') && uploadFile.size > SIGNED_UPLOAD_THRESHOLD && (
                          <span className="ml-1 text-primary">(akan diupload langsung ke Cloudinary)</span>
                        )}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex flex-col items-center gap-3 cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                      <Camera className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">Drag & drop gambar atau video di sini</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Gambar (maks. 10MB) atau Video MP4/WebM (maks. 50MB)
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        Gambar besar & video diupload langsung ke Cloudinary
                      </p>
                    </div>
                    <Button variant="outline" size="sm" type="button">
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                      Pilih File
                    </Button>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/mp4,video/webm,video/quicktime"
                  onChange={handleInputChange}
                  className="hidden"
                  aria-label="Pilih file gambar atau video untuk upload"
                />
              </div>

              {/* Upload Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Folder tujuan</Label>
                  <Input
                    placeholder="avatars"
                    value={uploadFolderInput}
                    onChange={(e) => setUploadFolderInput(e.target.value)}
                    className="text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Gambar akan disimpan di folder ini di Cloudinary
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Public ID (nama file)</Label>
                  <Input
                    placeholder="nama_file_unik"
                    value={uploadPublicId}
                    onChange={(e) => setUploadPublicId(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '_'))}
                    className="text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Nama unik untuk gambar di Cloudinary (opsional)
                  </p>
                </div>
              </div>

              {/* Upload Button */}
              {uploadPreview && (
                <div className="flex justify-end stagger-item-subtle">
                  <Button
                    onClick={handleUpload}
                    disabled={isUploading || isCompressing}
                    className="min-w-[160px]"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                        Mengupload...
                      </>
                    ) : (
                      <>
                        <Cloud className="w-4 h-4 mr-1.5" />
                        Upload & Pilih
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-xs text-muted-foreground">
            {uploadTab === 'browse' ? (
              <>
                {filteredImages.length} gambar ditemukan
                {currentImage && (
                  <span className="ml-2 text-primary">
                    Current: {currentImage.split('/').pop()?.split('?')[0]}
                  </span>
                )}
              </>
            ) : (
              <span className="flex items-center gap-1">
                <Cloud className="w-3 h-3" />
                Upload ke Cloudinary
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Batal
            </Button>
            {uploadTab === 'browse' && (
              <Button onClick={handleSelect} disabled={!selectedImage}>
                {selectedImage ? (
                  <>
                    <Check className="w-4 h-4 mr-1.5" />
                    Pilih Gambar
                  </>
                ) : (
                  'Pilih gambar'
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
