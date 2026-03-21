import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr } from "@react-email/components";
import * as React from "react";

interface WalletCreditEmailProps { name: string; amountMb: number; amountInr: number; description: string; newBalance: number; }

export function WalletCreditEmailTemplate({ name, amountMb, amountInr, description, newBalance }: WalletCreditEmailProps) {
  return (
    <Html><Head />
      <Preview>₥{amountMb.toLocaleString()} has been credited to your NexCell wallet</Preview>
      <Body style={{ backgroundColor: "#070B14", fontFamily: "sans-serif", padding: "40px 16px" }}>
        <Container style={{ backgroundColor: "#0D1117", borderRadius: "16px", border: "1px solid #1C2540", maxWidth: "520px", margin: "0 auto" }}>
          <Section style={{ padding: "32px 40px 24px", textAlign: "center" as const }}>
            <Heading style={{ color: "#ffffff", fontSize: "28px", margin: "0 0 8px" }}>Nex<span style={{ color: "#06B6D4" }}>Cell</span></Heading>
          </Section>
          <Hr style={{ borderColor: "#1C2540", margin: "0" }} />
          <Section style={{ padding: "32px 40px" }}>
            <Text style={{ color: "#06B6D4", fontSize: "13px", fontWeight: "600", textTransform: "uppercase" as const, letterSpacing: "0.08em", margin: "0 0 8px" }}>Wallet credited</Text>
            <Heading style={{ color: "#ffffff", fontSize: "36px", margin: "0 0 4px" }}>+₥{amountMb.toLocaleString()}</Heading>
            <Text style={{ color: "#64748B", fontSize: "14px", margin: "0 0 24px" }}>₹{amountInr} converted at 1:100 rate</Text>
            <Text style={{ color: "#94A3B8", fontSize: "14px", margin: "0 0 8px" }}><strong style={{ color: "#ffffff" }}>Description:</strong> {description}</Text>
            <Text style={{ color: "#94A3B8", fontSize: "14px", margin: "0" }}><strong style={{ color: "#ffffff" }}>New balance:</strong> <span style={{ color: "#06B6D4" }}>₥{newBalance.toLocaleString()}</span></Text>
          </Section>
          <Hr style={{ borderColor: "#1C2540", margin: "0" }} />
          <Section style={{ padding: "20px 40px", textAlign: "center" as const }}>
            <Text style={{ color: "#475569", fontSize: "12px", margin: "0" }}>NexCell · nexcell.mirai@gmail.com</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
export default WalletCreditEmailTemplate;
