import { ref, uploadBytes, getDownloadURL, uploadString } from 'firebase/storage';
import { storage } from '../firebase';

export const storageService = {
  /**
   * Upload a File object (from file input / drag & drop) to Firebase Storage
   */
  async uploadFile(file: File, folderPath: string): Promise<string> {
    try {
      const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const uniqueName = `${Date.now()}_${cleanName}`;
      const fileRef = ref(storage, `${folderPath}/${uniqueName}`);
      
      const snap = await uploadBytes(fileRef, file);
      const downloadUrl = await getDownloadURL(snap.ref);
      return downloadUrl;
    } catch (err) {
      console.error('Error uploading file to Firebase Storage:', err);
      throw err;
    }
  },

  /**
   * Upload base64 encoded audio string to Firebase Storage
   */
  async uploadBase64Audio(base64Data: string, candidateId: string, part: string): Promise<string> {
    try {
      // First, try uploading to our robust local Express server disk storage
      const response = await fetch('/api/candidates/upload-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: candidateId,
          part: part,
          audioData: base64Data
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.audioPath) {
          console.log('Successfully saved speaking recording to local Express server:', data.audioPath);
          return data.audioPath;
        }
      }
    } catch (err) {
      console.warn('Express server audio upload failed, falling back to Firebase Storage:', err);
    }

    try {
      let cleanBase64 = base64Data;
      let contentType = 'audio/webm';
      let ext = 'webm';
      
      if (base64Data.includes(',')) {
        const parts = base64Data.split(',');
        cleanBase64 = parts[1];
        const match = parts[0].match(/data:(.*?);base64/);
        if (match && match[1]) {
          contentType = match[1];
          if (contentType.includes('mp4')) ext = 'mp4';
          else if (contentType.includes('m4a')) ext = 'm4a';
          else if (contentType.includes('ogg')) ext = 'ogg';
          else if (contentType.includes('wav')) ext = 'wav';
        }
      }
      
      const fileRef = ref(storage, `candidates/${candidateId}/${part}.${ext}`);
      const snap = await uploadString(fileRef, cleanBase64, 'base64', {
        contentType
      });
      const downloadUrl = await getDownloadURL(snap.ref);
      return downloadUrl;
    } catch (err) {
      console.error('Error uploading base64 audio to Firebase Storage:', err);
      throw err;
    }
  }
};
