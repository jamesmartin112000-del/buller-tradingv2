import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Group,
  Modal,
  Stack,
  Text,
  Title } from
'@mantine/core';
import { ExternalLinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { fsSubscribeDoc, fsUpdate } from '../../lib/backend/docStore';
import { useContent } from '../../lib/db/hooks';

interface SocialProgress {
  instagram: boolean;
  facebook: boolean;
  youtube: boolean;
  waived: boolean;
  completedAt?: number;
}

const DEFAULT_PROGRESS: SocialProgress = {
  instagram: false,
  facebook: false,
  youtube: false,
  waived: false
};

export function SocialStepsModal() {
  const { user, logout } = useAuth();
  const instagramUrl = useContent('social.instagramUrl', 'https://instagram.com/');
  const facebookUrl = useContent('social.facebookUrl', 'https://facebook.com/');
  const youtubeUrl = useContent('social.youtubeUrl', 'https://youtube.com/');
  const [progress, setProgress] = useState<SocialProgress | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setProgress(null);
      return;
    }
    return fsSubscribeDoc<{socialProgress?: SocialProgress;}>(
      'users',
      user.uid,
      (profile) => setProgress({ ...DEFAULT_PROGRESS, ...profile?.socialProgress }),
      (error) => {
        console.error('Social progress subscription failed', error);
        setProgress(DEFAULT_PROGRESS);
      }
    );
  }, [user]);

  const complete = useMemo(
    () =>
    !!progress && (
    progress.waived ||
    progress.instagram && progress.facebook && progress.youtube),
    [progress]
  );

  const save = async (next: SocialProgress) => {
    if (!user) return;
    setSaving(true);
    try {
      const finalized =
      next.waived || next.instagram && next.facebook && next.youtube ?
      { ...next, completedAt: Date.now() } :
      next;
      await fsUpdate('users', user.uid, {
        socialProgress: finalized,
        socialPopupComplete: !!finalized.completedAt,
        updatedAt: Date.now()
      });
      setProgress(finalized);
      if (finalized.completedAt) toast.success('Social steps saved');
    } catch (error) {
      console.error('Unable to save social steps', error);
      toast.error('Social steps could not be saved. Please retry.');
    } finally {
      setSaving(false);
    }
  };

  if (!user || !progress || complete) return null;

  const steps = [
  { key: 'instagram' as const, label: 'Follow Instagram', url: instagramUrl },
  { key: 'facebook' as const, label: 'Follow Facebook page', url: facebookUrl },
  { key: 'youtube' as const, label: 'Subscribe to YouTube', url: youtubeUrl }];


  return (
    <Modal
      opened
      onClose={() => undefined}
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={false}
      centered
      size="lg"
      overlayProps={{ backgroundOpacity: 0.72, blur: 3 }}
      styles={{
        content: { background: '#0a3022', border: '1px solid rgba(226,191,118,.42)' },
        body: { padding: 0 }
      }}>
      
      <Box p={{ base: 'md', sm: 'xl' }}>
        <Stack gap="lg">
          <Box>
            <Text size="xs" fw={700} c="#e2bf76" tt="uppercase" lts="0.14em">
              BULLER TRADING Community
            </Text>
            <Title order={2} mt={6} c="#f3f1e9">Complete your social steps</Title>
            <Text size="sm" c="#c6c9bf" mt={6}>
              Open each official channel, complete the action, then mark it done.
            </Text>
          </Box>

          <Stack gap="sm">
            {steps.map((step, index) =>
            <Box
              key={step.key}
              p="md"
              style={{ background: '#08281c', border: '1px solid rgba(226,191,118,.28)', borderRadius: 8 }}>
              
                <Group justify="space-between" align="center" wrap="wrap" gap="sm">
                  <Box>
                    <Text size="xs" c="#92998e">STEP {index + 1}</Text>
                    <Text fw={700} c="#f3f1e9">{step.label}</Text>
                  </Box>
                  <Group gap="sm">
                    <Button
                    component="a"
                    href={step.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outline"
                    color="yellow"
                    leftSection={<ExternalLinkIcon size={16} />}>
                    
                      Open link
                    </Button>
                    <Checkbox
                    label="Done"
                    checked={progress[step.key]}
                    disabled={saving}
                    onChange={(event) =>
                    void save({ ...progress, [step.key]: event.currentTarget.checked })
                    }
                    color="yellow" />
                  
                  </Group>
                </Group>
              </Box>
            )}
          </Stack>

          <Box pt="md" style={{ borderTop: '1px solid rgba(226,191,118,.28)' }}>
            <Checkbox
              label="I have no social account"
              checked={progress.waived}
              disabled={saving}
              onChange={(event) => {
                if (event.currentTarget.checked) void save({ ...progress, waived: true });
              }}
              color="yellow" />
            
            <Text size="xs" c="#92998e" mt={6}>
              Selecting this option permanently waives the checklist for your account.
            </Text>
          </Box>
          <Button
            variant="subtle"
            color="gray"
            onClick={() => void logout()}
            disabled={saving}>
            
            Back to login / Sign out
          </Button>
        </Stack>
      </Box>
    </Modal>);

}