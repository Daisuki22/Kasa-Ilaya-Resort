import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ImagePlus, Loader2, Pencil, QrCode, Upload } from "lucide-react";
import { toast } from "sonner";
import { baseClient } from "@/api/baseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const createDefaultForm = () => ({
  label: "",
  account_name: "",
  account_number: "",
  instructions: "",
  image_url: "",
  display_order: 1,
  is_active: true,
});

export default function AdminPaymentQRCodes() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCode, setEditingCode] = useState(null);
  const [archiveId, setArchiveId] = useState(null);
  const [form, setForm] = useState(createDefaultForm());
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    baseClient.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: qrCodes = [], isLoading } = useQuery({
    queryKey: ["admin-payment-qr-codes"],
    queryFn: () => baseClient.entities.PaymentQrCode.list("display_order", 10),
  });

  const sortedCodes = useMemo(
    () => [...qrCodes].sort((left, right) => (left.display_order ?? 99) - (right.display_order ?? 99)),
    [qrCodes]
  );

  const activeCodes = useMemo(
    () => sortedCodes.filter((entry) => entry.is_active !== false && entry.is_active !== 0 && entry.is_active !== "0"),
    [sortedCodes]
  );

  useEffect(() => {
    if (!formOpen) {
      return;
    }

    setForm(editingCode ? {
      ...createDefaultForm(),
      ...editingCode,
    } : createDefaultForm());
    setSaving(false);
    setUploadingImage(false);
  }, [editingCode, formOpen]);

  const activeCodeCount = activeCodes.length;
  const canAddMore = activeCodeCount < 3;

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadingImage(true);

    try {
      const { file_url } = await baseClient.integrations.Core.UploadFile({ file });
      setForm((prev) => ({ ...prev, image_url: file_url }));
      toast.success("QR code image uploaded.");
    } catch (error) {
      toast.error(error?.message || "Unable to upload QR code image.");
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!form.label || !form.image_url) {
      toast.error("Please provide a label and QR image.");
      return;
    }

    setSaving(true);

    const payload = {
      label: form.label,
      account_name: form.account_name,
      account_number: form.account_number,
      instructions: form.instructions,
      image_url: form.image_url,
      display_order: Number(form.display_order) || 1,
      is_active: Boolean(form.is_active),
    };

    try {
      if (editingCode) {
        const updated = await baseClient.entities.PaymentQrCode.update(editingCode.id, payload);
        await baseClient.entities.ActivityLog.create({
          user_email: user?.email,
          user_name: user?.full_name,
          action: "Updated Payment QR Code",
          entity_type: "PaymentQrCode",
          entity_id: updated.id,
          details: `Updated QR code: ${updated.label}`,
        });
      } else {
        const created = await baseClient.entities.PaymentQrCode.create(payload);
        await baseClient.entities.ActivityLog.create({
          user_email: user?.email,
          user_name: user?.full_name,
          action: "Created Payment QR Code",
          entity_type: "PaymentQrCode",
          entity_id: created.id,
          details: `Created QR code: ${created.label}`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["admin-payment-qr-codes"] });
      setFormOpen(false);
      setEditingCode(null);
      toast.success(editingCode ? "QR code updated." : "QR code added.");
    } catch (error) {
      toast.error(error?.message || "Unable to save QR code.");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    const target = sortedCodes.find((entry) => entry.id === archiveId);

    try {
      await baseClient.entities.PaymentQrCode.update(archiveId, { is_active: false });
      await baseClient.entities.ActivityLog.create({
        user_email: user?.email,
        user_name: user?.full_name,
        action: "Archived Payment QR Code",
        entity_type: "PaymentQrCode",
        entity_id: archiveId,
        details: `Archived QR code: ${target?.label || archiveId}`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-payment-qr-codes"] });
      queryClient.invalidateQueries({ queryKey: ["booking-payment-qr-codes"] });
      toast.success("QR code archived.");
    } catch (error) {
      toast.error(error?.message || "Unable to archive QR code.");
    } finally {
      setArchiveId(null);
    }
  };

  return (
    <div className="w-full max-w-none px-2 py-6 sm:px-3 lg:px-4">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Manage Payment QR Codes</h1>
          <p className="mt-1 text-muted-foreground">Upload and manage up to 3 QR codes for reservation fee payments.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => { setEditingCode(null); setFormOpen(true); }} className="w-full gap-2 sm:w-auto" disabled={!canAddMore}>
            <ImagePlus className="h-4 w-4" /> Add QR Code
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>QR Code</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeCodes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">No active QR codes configured yet.</TableCell>
                  </TableRow>
                ) : activeCodes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell>
                      <img src={code.image_url} alt={code.label} className="h-16 w-16 rounded-lg border border-border object-cover" />
                    </TableCell>
                    <TableCell className="font-medium">{code.label}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{code.account_name || "No account name"}</p>
                        <p className="text-muted-foreground">{code.account_number || "No account number"}</p>
                      </div>
                    </TableCell>
                    <TableCell>{code.display_order}</TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${code.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        {code.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingCode(code); setFormOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-amber-600" onClick={() => setArchiveId(code.id)}>
                          <Archive className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingCode(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display">{editingCode ? 'Edit QR Code' : 'Add QR Code'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Label *</Label>
              <Input className="mt-1" value={form.label} onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))} placeholder="GCash - Main Account" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Account Name</Label>
                <Input className="mt-1" value={form.account_name} onChange={(event) => setForm((prev) => ({ ...prev, account_name: event.target.value }))} placeholder="Kasa Ilaya Resort" />
              </div>
              <div>
                <Label>Account Number</Label>
                <Input className="mt-1" value={form.account_number} onChange={(event) => setForm((prev) => ({ ...prev, account_number: event.target.value }))} placeholder="09XXXXXXXXX" />
              </div>
            </div>
            <div>
              <Label>Instructions</Label>
              <Textarea className="mt-1" rows={3} value={form.instructions} onChange={(event) => setForm((prev) => ({ ...prev, instructions: event.target.value }))} placeholder="Optional payment instructions for guests." />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Display Order</Label>
                <Input className="mt-1" type="number" min="1" max="3" value={form.display_order} onChange={(event) => setForm((prev) => ({ ...prev, display_order: Number(event.target.value) || 1 }))} />
              </div>
              <div className="flex items-end gap-2 pb-2">
                <Switch checked={form.is_active} onCheckedChange={(value) => setForm((prev) => ({ ...prev, is_active: value }))} />
                <Label>Active for booking</Label>
              </div>
            </div>
            <div>
              <Label>QR Image *</Label>
              <div className="mt-2 space-y-3">
                <label className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                  {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  <span>{uploadingImage ? "Uploading image..." : "Upload QR image"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                </label>
                {form.image_url ? (
                  <img src={form.image_url} alt={form.label || 'QR code preview'} className="h-48 w-full rounded-xl border border-border bg-white object-contain p-3" />
                ) : (
                  <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
                    <QrCode className="mr-2 h-4 w-4" /> No QR image uploaded yet
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="button" onClick={handleSave} disabled={saving || uploadingImage || !form.label || !form.image_url}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingCode ? 'Update QR Code' : 'Create QR Code'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!archiveId} onOpenChange={(open) => !open && setArchiveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive QR Code?</AlertDialogTitle>
            <AlertDialogDescription>
              This will hide the QR option from future reservation payments while keeping the data for reference.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} className="bg-amber-600 text-white hover:bg-amber-700">Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
