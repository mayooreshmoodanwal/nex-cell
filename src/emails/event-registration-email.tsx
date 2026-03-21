import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr, Button } from "@react-email/components";
import * as React from "react";
import { format } from "date-fns";

interface EventRegistrationEmailProps { name: string; eventTitle: string; eventDate: Date; eventId: string; isPaid: boolean; amountPaid?: number; }

export function EventRegistrationEmailTemplate({ name, eventTitle, eventDate, eventId, isPaid, amountPaid }: EventRegistrationEmailProps) {
  return (
    <Html><Head />
      <Preview>You&apos;re registered for {eventTitle}</Preview>
      <Body style={{ backgroundColor: "#070B14", fontFamily: "sans-serif", padding: "40px 16px" }}>
        <Container style={{ backgroundColor: "#0D1117", borderRadius: "16px", border: "1px solid #1C2540", maxWidth: "520px", margin: "0 auto" }}>
          <Section style={{ padding: "32px 40px 24px", textAlign: "center" as const }}>
            <Heading style={{ color: "#ffffff", fontSize: "28px", margin: "0 0 8px" }}>Nex<span style={{ color: "#06B6D4" }}>Cell</span></Heading>
          </Section>
          <Hr style={{ borderColor: "#1C2540", margin: "0" }} />
          <Section style={{ padding: "32px 40px" }}>
            <Text style={{ color: "#10B981", fontSize: "13px", fontWeight: "600", textTransform: "uppercase" as const, letterSpacing: "0.08em", margin: "0 0 8px" }}>Registration confirmed</Text>
            <Heading style={{ color: "#ffffff", fontSize: "22px", margin: "0 0 20px" }}>{eventTitle}</Heading>
            <Text style={{ color: "#94A3B8", fontSize: "14px", margin: "0 0 8px" }}><strong style={{ color: "#ffffff" }}>Date:</strong> {format(eventDate, "EEEE, MMMM d, yyyy 'at' h:mm a")}</Text>
            {isPaid && amountPaid && <Text style={{ color: "#94A3B8", fontSize: "14px", margin: "0 0 24px" }}><strong style={{ color: "#ffffff" }}>Paid:</strong> <span style={{ color: "#06B6D4" }}>₥{amountPaid.toLocaleString()}</span></Text>}
            <Button href={`${process.env.NEXT_PUBLIC_APP_URL}/events/${eventId}`}
              style={{ backgroundColor: "#06B6D4", color: "#ffffff", borderRadius: "8px", padding: "12px 28px", fontSize: "14px", fontWeight: "600", textDecoration: "none", display: "inline-block" }}>
              View event details
            </Button>
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
export default EventRegistrationEmailTemplate;
