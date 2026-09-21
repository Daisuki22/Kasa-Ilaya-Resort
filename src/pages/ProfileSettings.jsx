import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { baseClient } from '@/api/baseClient';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, Loader2, Upload } from 'lucide-react';

export default function ProfileSettings({
  title = 'Profile settings',
  description = 'Manage your personal details and account password.',
}) {
  const [user, setUser] = useState(null);
  const [profileForm, setProfileForm] = useState({ full_name: '', email: '', phone: '', profile_image_url: '' });
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const syncProfileState = (currentUser) => {
    setUser(currentUser);
    setProfileForm({
      full_name: currentUser.full_name || '',
      email: currentUser.email || '',
      phone: currentUser.phone || '',
      profile_image_url: currentUser.profile_image_url || '',
    });
  };

  useEffect(() => {
    baseClient.auth.me()
      .then((currentUser) => {
        syncProfileState(currentUser);
      })
      .catch(() => {
        baseClient.auth.redirectToLogin(window.location.href);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setSavingProfile(true);

    try {
      const updatedUser = await baseClient.auth.updateMe(profileForm);
      syncProfileState(updatedUser);
      toast.success('Profile updated successfully.');
    } catch (error) {
      toast.error(error.message || 'Unable to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleProfilePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Please upload a JPG, PNG, or WebP profile photo.');
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Profile photo must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }

    setUploadingPhoto(true);

    try {
      const { file_url } = await baseClient.integrations.Core.UploadFile({ file, purpose: 'profile_image' });
      const updatedUser = await baseClient.auth.updateMe({ profile_image_url: file_url });
      syncProfileState(updatedUser);
      toast.success('Profile photo updated.');
    } catch (error) {
      toast.error(error?.message || 'Unable to upload profile photo.');
    } finally {
      setUploadingPhoto(false);
      event.target.value = '';
    }
  };

  const handleRemoveProfilePhoto = async () => {
    setUploadingPhoto(true);

    try {
      const updatedUser = await baseClient.auth.updateMe({ profile_image_url: '' });
      syncProfileState(updatedUser);
      toast.success('Profile photo removed.');
    } catch (error) {
      toast.error(error?.message || 'Unable to remove profile photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();

    if (passwordForm.new_password !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await baseClient.auth.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordForm({ current_password: '', new_password: '', confirmPassword: '' });
      toast.success('Password updated successfully.');
    } catch (error) {
      toast.error(error.message || 'Unable to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return <div className="px-4 py-10 text-sm text-muted-foreground">Loading profile...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="w-full max-w-none px-2 py-6 sm:px-3 lg:px-4">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-foreground">{title}</h1>
        <p className="mt-2 text-muted-foreground">{description}</p>
      </div>

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-border bg-primary/10">
            {profileForm.profile_image_url ? (
              <img src={profileForm.profile_image_url} alt={profileForm.full_name || 'Profile photo'} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-primary">
                {profileForm.full_name?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 flex justify-center bg-background/80 py-1 backdrop-blur">
              <Camera className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-foreground">{profileForm.full_name || 'Unnamed user'}</p>
            <p className="break-all text-sm text-muted-foreground">{profileForm.email}</p>
            <p className="mt-1 text-sm text-muted-foreground">{profileForm.phone || 'No phone number added'}</p>
            <p className="mt-2 inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground">
              {(user.role || 'guest').replace(/_/g, ' ')}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
              {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span>{uploadingPhoto ? 'Uploading...' : 'Upload Photo'}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleProfilePhotoUpload} disabled={uploadingPhoto} />
            </label>
            {profileForm.profile_image_url ? (
              <Button type="button" variant="outline" size="sm" onClick={handleRemoveProfilePhoto} disabled={uploadingPhoto}>
                Remove Photo
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile details</CardTitle>
            <CardDescription>Update the information associated with your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleProfileSubmit}>
              <div className="space-y-2">
                <Label htmlFor="profile-name">Full name</Label>
                <Input id="profile-name" value={profileForm.full_name} onChange={(event) => setProfileForm((current) => ({ ...current, full_name: event.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-email">Email</Label>
                <Input id="profile-email" type="email" value={profileForm.email} onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-phone">Phone number</Label>
                <Input id="profile-phone" value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} />
              </div>
              <Button className="w-full sm:w-auto" disabled={savingProfile} type="submit">Save changes</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Update password</CardTitle>
            <CardDescription>Use your current password to set a new one.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handlePasswordSubmit}>
              <div className="space-y-2">
                <Label htmlFor="current-password">Current password</Label>
                <Input id="current-password" type="password" value={passwordForm.current_password} onChange={(event) => setPasswordForm((current) => ({ ...current, current_password: event.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input id="new-password" type="password" value={passwordForm.new_password} onChange={(event) => setPasswordForm((current) => ({ ...current, new_password: event.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input id="confirm-password" type="password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} required />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button className="w-full sm:w-auto" disabled={savingPassword} type="submit">Update password</Button>
                <Link
                  to={`${createPageUrl('ForgotPassword')}?email=${encodeURIComponent(profileForm.email || user.email || '')}`}
                  className="text-center text-sm text-primary hover:underline sm:text-left"
                >
                  Forgot password?
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
