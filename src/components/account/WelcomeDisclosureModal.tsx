import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Text,
  Title } from
'@mantine/core';
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ShieldAlertIcon } from
'lucide-react';
import { useAuth } from '../../context/AuthContext';

const DISCLOSURE_KEY_PREFIX = 'buller.risk-disclosure.session';

export function WelcomeDisclosureModal() {
  const { user } = useAuth();
  const [acknowledged, setAcknowledged] = useState<boolean | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    setConfirmed(false);

    if (!user) {
      setAcknowledged(null);
      return;
    }

    try {
      setAcknowledged(
        window.sessionStorage.getItem(
          `${DISCLOSURE_KEY_PREFIX}.${user.uid}`
        ) === 'accepted'
      );
    } catch {
      setAcknowledged(false);
    }
  }, [user]);

  if (!user || acknowledged === null || acknowledged) return null;

  const acceptDisclosure = () => {
    if (!confirmed) return;

    try {
      window.sessionStorage.setItem(
        `${DISCLOSURE_KEY_PREFIX}.${user.uid}`,
        'accepted'
      );
    } catch {

      // The acknowledgement still applies for the current mounted session.
    }
    setAcknowledged(true);
  };

  return (
    <Modal
      opened
      onClose={() => undefined}
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={false}
      centered
      size="lg"
      overlayProps={{ backgroundOpacity: 0.82, blur: 5 }}
      styles={{
        content: {
          background: '#08281c',
          border: '1px solid rgba(226,191,118,.52)',
          maxHeight: 'calc(100dvh - 24px)'
        },
        body: {
          padding: 0
        }
      }}>
      
      <ScrollArea.Autosize
        mah="calc(100dvh - 26px)"
        type="auto">
        
        <Box p={{ base: 'md', sm: 'xl' }}>
          <Stack gap="md">

            {/* HEADER */}
            <Group gap="sm" wrap="nowrap" align="flex-start">
              <Box className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-brand/40 bg-brand/10">
                <ShieldAlertIcon
                  size={20}
                  className="text-brand"
                  aria-hidden="true" />
                
              </Box>

              <Box>
                <Text
                  size="10px"
                  fw={800}
                  c="#e2bf76"
                  tt="uppercase"
                  lts="0.14em">
                  
                  Welcome to BULLER TRADING
                </Text>

                <Title
                  order={2}
                  c="#f3f1e9"
                  mt={3}
                  className="text-xl sm:text-2xl">
                  
                  Welcome, {user.name || 'Trader'}
                </Title>

                <Text size="xs" c="#c6c9bf" mt={4}>
                  Please review this trading risk disclosure before using the
                  analysis dashboard.
                </Text>
              </Box>
            </Group>

            {/* MAIN RISK WARNING */}
            <Alert
              color="yellow"
              variant="light"
              icon={<AlertTriangleIcon size={18} />}
              title="Important Trading Risk Warning">
              
              <Text size="sm" c="#f3f1e9" lh={1.55}>
                The signals provided by <strong>BULLER TRADING</strong> are
                based on our market analysis, trading strategy, price action,
                market conditions, and other relevant factors. Our purpose is
                to analyze the market and provide a possible{' '}
                <strong>BUY or SELL scenario</strong> based on our strategy.
              </Text>

              <Text size="sm" c="#f3f1e9" lh={1.55} mt="sm">
                However, <strong>no trading tool, strategy, indicator, AI
                system, or signal provider can guarantee 100% accuracy.</strong>{' '}
                Every market analysis is based on probability, and the market
                can move differently from the expected scenario at any time.
              </Text>
            </Alert>

            {/* STRATEGY WARNING */}
            <Box>
              <Text
                size="sm"
                fw={800}
                c="#e2bf76"
                mb={6}>
                
                Our Strategy Does Not Work Every Time
              </Text>

              <Text size="xs" c="#c6c9bf" lh={1.6}>
                No trading strategy works on every trade or in every market
                condition. <strong>Losses are a normal part of trading.</strong>{' '}
                This is why proper risk management and the use of a{' '}
                <strong>Stop Loss (SL)</strong> are essential.
              </Text>

              <Text size="xs" c="#c6c9bf" lh={1.6} mt={8}>
                Always use a Stop Loss and maintain proper trading discipline.
                <strong> Never remove, move, or ignore your Stop Loss</strong>{' '}
                simply because you expect the market to return to your entry.
              </Text>
            </Box>

            {/* TRADE WITH DISCIPLINE */}
            <Box>
              <Text
                size="sm"
                fw={800}
                c="#e2bf76"
                mb={8}>
                
                Trade With Discipline
              </Text>

              <Stack gap={9}>
                {[
                'Take only trades that meet your strategy and risk criteria.',
                'Use a Stop Loss on every trade.',
                'Never increase your risk emotionally after a losing trade.',
                'Do not chase the market or revenge trade.',
                'Stay disciplined and focused.',
                'If your daily profit target is achieved, close the day.',
                'If your daily loss limit is reached, close the day.'].
                map((item) =>
                <Group
                  key={item}
                  gap={8}
                  wrap="nowrap"
                  align="flex-start">
                  
                    <CheckCircle2Icon
                    size={14}
                    className="mt-0.5 shrink-0 text-brand"
                    aria-hidden="true" />
                  

                    <Text
                    size="xs"
                    c="#c6c9bf"
                    lh={1.5}>
                    
                      {item}
                    </Text>
                  </Group>
                )}
              </Stack>

              <Text size="xs" c="#c6c9bf" lh={1.6} mt={10}>
                As a general risk-management guideline, consider risking{' '}
                <strong>no more than 2% of your trading capital on a single
                trade.</strong>{' '}
                Your actual risk should always depend on your own financial
                situation and risk tolerance.
              </Text>
            </Box>

            {/* OUR ROLE */}
            <Box>
              <Text
                size="sm"
                fw={800}
                c="#e2bf76"
                mb={6}>
                
                Our Role
              </Text>

              <Text size="xs" c="#c6c9bf" lh={1.6}>
                <strong>BULLER TRADING analyzes the market and shares the
                resulting analysis, scenarios, and signals with you.</strong>
              </Text>

              <Text size="xs" c="#c6c9bf" lh={1.6} mt={8}>
                How you use that information, whether you enter a trade, how
                much you risk, and how you manage the trade is{' '}
                <strong>entirely your own responsibility.</strong>
              </Text>

              <Text size="xs" c="#c6c9bf" lh={1.6} mt={8}>
                A signal is <strong>not a guarantee of profit</strong> and
                should never be treated as a guaranteed prediction of the
                market.
              </Text>
            </Box>

            {/* NOT FOR BEGINNERS */}
            <Alert
              color="yellow"
              variant="light"
              icon={<AlertTriangleIcon size={18} />}
              title="Important: This Tool Is Not For Beginners">
              
              <Text size="xs" c="#f3f1e9" lh={1.6}>
                This tool is intended for traders who already have a basic
                understanding of <strong>trading, market analysis, risk
                management, Stop Loss, Take Profit, and trading
                psychology.</strong>
              </Text>

              <Text size="xs" c="#f3f1e9" lh={1.6} mt={8}>
                <strong>
                  If you do not have sufficient trading knowledge and
                  experience, do not use this tool to make trading decisions.
                </strong>{' '}
                Learn and understand the fundamentals of trading and risk
                management first.
              </Text>
            </Alert>

            {/* FINAL REMINDER */}
            <Box>
              <Text
                size="sm"
                fw={800}
                c="#e2bf76"
                mb={6}>
                
                Final Reminder
              </Text>

              <Text size="xs" c="#c6c9bf" lh={1.6}>
                <strong>
                  There is no guaranteed signal in trading. There is only
                  analysis, probability, risk management, and discipline.
                </strong>
              </Text>

              <Stack gap={3} mt={8}>
                <Text size="xs" c="#c6c9bf">
                  Trade with a plan.
                </Text>

                <Text size="xs" c="#c6c9bf">
                  Use your Stop Loss.
                </Text>

                <Text size="xs" c="#c6c9bf">
                  Follow your rules.
                </Text>

                <Text size="xs" c="#c6c9bf">
                  Control your risk.
                </Text>

                <Text size="xs" c="#e2bf76" fw={800}>
                  Protect your capital first.
                </Text>
              </Stack>
            </Box>

            {/* CHECKBOX */}
            <Box className="rounded-md border border-line bg-bg-900 p-3">
              <Checkbox
                checked={confirmed}
                onChange={(event) =>
                setConfirmed(event.currentTarget.checked)
                }
                color="yellow"
                label="I have read and understood this trading risk warning. I understand that BULLER TRADING signals are based on market analysis and probability, not guaranteed results. I will use proper risk management, follow my own trading rules, and take full responsibility for my trading decisions."
                styles={{
                  label: {
                    color: '#f3f1e9',
                    fontSize: 12,
                    lineHeight: 1.5
                  }
                }} />
              
            </Box>

            {/* BUTTON */}
            <Button
              color="yellow"
              fullWidth
              size="md"
              disabled={!confirmed}
              onClick={acceptDisclosure}>
              
              I Understand — Enter Dashboard
            </Button>

            {/* FOOTER */}
            <Text
              size="9px"
              c="#92998e"
              ta="center">
              
              This acknowledgement does not remove or reduce the risks of
              trading.
            </Text>

          </Stack>
        </Box>
      </ScrollArea.Autosize>
    </Modal>);

}