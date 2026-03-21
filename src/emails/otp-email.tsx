/**
 * OTP EMAIL TEMPLATE
 * The login code email — the most critical email in the system.
 * Uses React Email components for consistent rendering across email clients.
 */

import {
  Body, Container, Head, Heading, Html, Preview,
  Section, Text, Hr, Row, Column,
} from "@react-email/components";
import * as React from "react";

interface OtpEmailProps {
  otp:        string;
  email:      string;
  expiresAt:  Date;
  ipAddress?: string;
}

export function OtpEmailTemplate({ otp, email, expiresAt, ipAddress }: OtpEmailProps) {
  const digits = otp.split("");

  return (
    <Html>
      <Head />
      <Preview>Your NexCell login code: {otp} (expires in 5 minutes)</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>

          {/* Header */}
          <Section style={styles.header}>
            <Heading style={styles.logo}>
              Nex<span style={{ color: "#06B6D4" }}>Cell</span>
            </Heading>
            <Text style={styles.tagline}>Entrepreneurship Club · Mirai School of Technology</Text>
          </Section>

          <Hr style={styles.divider} />

          {/* Content */}
          <Section style={styles.content}>
            <Text style={styles.greeting}>Your login code</Text>
            <Text style={styles.instruction}>
              Enter this code on the NexCell login page to sign in.
              Do not share this code with anyone.
            </Text>

            {/* OTP Display */}
            <Section style={styles.otpContainer}>
              <Row>
                {digits.map((digit, i) => (
                  <Column key={i} style={styles.digitCell}>
                    <Text style={styles.digit}>{digit}</Text>
                  </Column>
                ))}
              </Row>
            </Section>

            <Text style={styles.expiry}>
              This code expires at {expiresAt.toLocaleTimeString("en-IN", {
                hour:   "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Kolkata",
              })} IST
            </Text>
          </Section>

          <Hr style={styles.divider} />

          {/* Security note */}
          <Section style={styles.securityNote}>
            <Text style={styles.securityTitle}>Security notice</Text>
            <Text style={styles.securityText}>
              If you did not request this code, please ignore this email.
              Your account is safe — no action is needed.
            </Text>
            {ipAddress && (
              <Text style={styles.ipText}>
                Request from IP: {ipAddress}
              </Text>
            )}
          </Section>

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              NexCell — Entrepreneurship Club of Mirai School of Technology
            </Text>
            <Text style={styles.footerText}>
              nexcell.mirai@gmail.com · Instagram: @nexcell.mirai
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

const styles: Record<string, React.CSSProperties> = {
  body: {
    backgroundColor: "#070B14",
    fontFamily:      "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    margin:          "0",
    padding:         "40px 16px",
  },
  container: {
    backgroundColor: "#0D1117",
    borderRadius:    "16px",
    border:          "1px solid #1C2540",
    maxWidth:        "520px",
    margin:          "0 auto",
    overflow:        "hidden",
  },
  header: {
    padding:   "32px 40px 24px",
    textAlign: "center",
  },
  logo: {
    color:      "#ffffff",
    fontSize:   "28px",
    fontWeight: "700",
    margin:     "0 0 8px",
    letterSpacing: "-0.5px",
  },
  tagline: {
    color:     "#64748B",
    fontSize:  "13px",
    margin:    "0",
  },
  divider: {
    borderColor: "#1C2540",
    margin:      "0",
  },
  content: {
    padding: "32px 40px",
  },
  greeting: {
    color:      "#ffffff",
    fontSize:   "20px",
    fontWeight: "600",
    margin:     "0 0 8px",
  },
  instruction: {
    color:      "#94A3B8",
    fontSize:   "14px",
    lineHeight: "1.6",
    margin:     "0 0 28px",
  },
  otpContainer: {
    backgroundColor: "#141B2D",
    borderRadius:    "12px",
    border:          "1px solid #1C2540",
    padding:         "20px",
    textAlign:       "center",
    marginBottom:    "16px",
  },
  digitCell: {
    padding: "0 6px",
  },
  digit: {
    color:           "#06B6D4",
    fontSize:        "36px",
    fontWeight:      "700",
    fontFamily:      "monospace",
    letterSpacing:   "4px",
    margin:          "0",
    textAlign:       "center",
  },
  expiry: {
    color:     "#64748B",
    fontSize:  "13px",
    textAlign: "center",
    margin:    "0",
  },
  securityNote: {
    padding: "24px 40px",
  },
  securityTitle: {
    color:      "#94A3B8",
    fontSize:   "12px",
    fontWeight: "600",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    margin:     "0 0 8px",
  },
  securityText: {
    color:      "#64748B",
    fontSize:   "13px",
    lineHeight: "1.6",
    margin:     "0 0 8px",
  },
  ipText: {
    color:      "#475569",
    fontSize:   "12px",
    fontFamily: "monospace",
    margin:     "0",
  },
  footer: {
    borderTop: "1px solid #1C2540",
    padding:   "20px 40px",
    textAlign: "center",
  },
  footerText: {
    color:     "#475569",
    fontSize:  "12px",
    margin:    "0 0 4px",
  },
};

export default OtpEmailTemplate;
