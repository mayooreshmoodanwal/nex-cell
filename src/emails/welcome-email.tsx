import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr, Button } from "@react-email/components";
import * as React from "react";

interface WelcomeEmailProps { name: string; email: string; }

export function WelcomeEmailTemplate({ name, email }: WelcomeEmailProps) {
  return (
    <Html><Head />
      <Preview>Welcome to NexCell — Where Founders Are Made</Preview>
      <Body style={{ backgroundColor: "#070B14", fontFamily: "sans-serif", padding: "40px 16px" }}>
        <Container style={{ backgroundColor: "#0D1117", borderRadius: "16px", border: "1px solid #1C2540", maxWidth: "520px", margin: "0 auto" }}>
          <Section style={{ padding: "32px 40px 24px", textAlign: "center" as const }}>
            <Heading style={{ color: "#ffffff", fontSize: "28px", margin: "0 0 8px" }}>
              Nex<span style={{ color: "#06B6D4" }}>Cell</span>
            </Heading>
            <Text style={{ color: "#64748B", fontSize: "13px", margin: "0" }}>Entrepreneurship Club · Mirai School of Technology</Text>
          </Section>
          <Hr style={{ borderColor: "#1C2540", margin: "0" }} />
          <Section style={{ padding: "32px 40px" }}>
            <Heading style={{ color: "#ffffff", fontSize: "22px", margin: "0 0 16px" }}>Welcome, {name}!</Heading>
            <Text style={{ color: "#94A3B8", fontSize: "15px", lineHeight: "1.7", margin: "0 0 24px" }}>
              You&apos;ve just joined NexCell — the entrepreneurship club of Mirai School of Technology.
              Your account is ready. Explore upcoming events, build your Mirai Bucks wallet, and connect with fellow founders.
            </Text>
            <Button href={`${process.env.NEXT_PUBLIC_APP_URL}/dashboard`}
              style={{ backgroundColor: "#06B6D4", color: "#ffffff", borderRadius: "8px", padding: "12px 28px", fontSize: "14px", fontWeight: "600", textDecoration: "none", display: "inline-block" }}>
              Go to my dashboard
            </Button>
          </Section>
          <Hr style={{ borderColor: "#1C2540", margin: "0" }} />
          <Section style={{ padding: "20px 40px", textAlign: "center" as const }}>
            <Text style={{ color: "#475569", fontSize: "12px", margin: "0" }}>
              NexCell · nexcell.mirai@gmail.com · @nexcell.mirai
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
export default WelcomeEmailTemplate;
