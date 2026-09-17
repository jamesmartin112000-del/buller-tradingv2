import type {
  AccessRequest,
  DBUser,
  DeviceLog,
  MasterKey,
  PaymentProof } from
'../db/store';

interface ExportUsersInput {
  users: DBUser[];
  payments: PaymentProof[];
  devices: DeviceLog[];
  keys: MasterKey[];
  requests: AccessRequest[];
}

export async function exportUsersExcel(input: ExportUsersInput) {
  const imported = (await import('xlsx')) as typeof import('xlsx') & {
    default?: typeof import('xlsx');
  };
  const XLSX = imported.utils ? imported : imported.default;
  if (!XLSX?.utils?.book_new || !XLSX.utils.json_to_sheet || !XLSX.writeFile) {
    throw new Error('Excel export is unavailable in this browser.');
  }
  const paymentCount = countByEmail(input.payments, (item) => item.email);
  const deviceCount = countByEmail(input.devices, (item) => item.userEmail);
  const keyCount = countByEmail(input.keys, (item) => item.email);
  const requestByEmail = new Map(
    input.requests.map((item) => [item.email.toLowerCase(), item])
  );

  const usersSheet = input.users.map((user) => {
    const email = user.email.toLowerCase();
    const request = requestByEmail.get(email);
    return {
      'User ID': user.uid || user.id,
      Name: user.name,
      Email: user.email,
      WhatsApp: user.whatsapp || request?.whatsapp || '',
      Username: user.username || '',
      Country: request?.country || '',
      Role: user.role,
      Status: user.status,
      Approved: yesNo(user.approved),
      'KYC Approved': yesNo(user.kycApproved),
      'KYC Status': user.kyc?.status || 'not submitted',
      'Payment Approved': yesNo(user.paymentApproved),
      'Subscription Active': yesNo(user.subscriptionActive),
      'Plan': (user as DBUser & {subscriptionPlan?: string;}).subscriptionPlan || '',
      'Valid From': formatDate(user.validityStartedAt),
      'Valid Until': formatDate(user.expiresAt || user.validityExpiresAt),
      'Max Devices': user.maxDevices ?? 1,
      'Active Devices': user.activeDevices ?? 0,
      'Device Records': deviceCount.get(email) || 0,
      'Payment Records': paymentCount.get(email) || 0,
      'Master Keys': keyCount.get(email) || 0,
      'Access Request': request?.status || 'none',
      'Created At': formatDate(user.createdAt),
      'Last Seen': formatDate(user.lastSeen)
    };
  });

  const paymentsSheet = input.payments.map((payment) => ({
    ID: payment.id,
    Email: payment.email,
    Name: payment.userName || '',
    Plan: payment.plan,
    Amount: payment.amount,
    Currency: payment.currency || 'USDT',
    Network: payment.network,
    TXID: payment.txid || '',
    Status: payment.status,
    'Validity Days': payment.validityDaysGranted || '',
    Submitted: formatDate(payment.createdAt),
    Reviewed: formatDate(payment.reviewedAt),
    'Admin Notes': payment.adminNotes || '',
    'Proof URL': payment.proofUrl
  }));

  const devicesSheet = input.devices.map((device) => ({
    ID: device.id,
    Email: device.userEmail,
    'Device ID': device.deviceId,
    Label: device.label || '',
    Status: device.status,
    'User Agent': device.userAgent,
    Created: formatDate(device.createdAt),
    Reviewed: formatDate(device.reviewedAt),
    'Review Note': device.reviewNote || ''
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(usersSheet), 'Users');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(paymentsSheet), 'Payments');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(devicesSheet), 'Devices');
  XLSX.writeFile(workbook, `buller-users-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function countByEmail<T>(items: T[], getEmail: (item: T) => string) {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const email = getEmail(item).toLowerCase();
    counts.set(email, (counts.get(email) || 0) + 1);
  });
  return counts;
}

function yesNo(value: boolean | undefined) {
  return value ? 'Yes' : 'No';
}

function formatDate(value: number | undefined) {
  return value ? new Date(value).toLocaleString() : '';
}