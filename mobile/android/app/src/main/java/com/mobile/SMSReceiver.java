package com.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.telephony.SmsMessage;
import android.util.Log;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class SMSReceiver extends BroadcastReceiver {

    private static final String TAG        = "SMSReceiver";
    private static final String BACKEND_URL =
            "https://finance-ai-backend-pkjk.onrender.com/process-sms";

    // ── keywords that indicate a debit/spending SMS ──────────────────────────
    private static final String[] DEBIT_KEYWORDS = {
        "debited", "debit", "paid", "payment", "spent",
        "withdrawn", "purchase", "charged", "transferred"
    };

    @Override
    public void onReceive(Context context, Intent intent) {

        Bundle bundle = intent.getExtras();
        if (bundle == null) return;

        Object[] pdus = (Object[]) bundle.get("pdus");
        if (pdus == null) return;

        for (Object pdu : pdus) {

            SmsMessage message = SmsMessage.createFromPdu((byte[]) pdu);
            String body = message.getMessageBody();

            Log.d(TAG, "SMS received: " + body);

            // Only process debit/spending SMS
            if (!isDebitSMS(body)) {
                Log.d(TAG, "Not a debit SMS, skipping.");
                continue;
            }

            String amount = extractAmount(body);
            if (amount == null) {
                Log.d(TAG, "Could not extract amount, skipping.");
                continue;
            }

            // Read auth token saved by the React Native app
            String token = TokenModule.getToken(context);
            if (token == null) {
                Log.w(TAG, "No auth token found — user not logged in, skipping.");
                continue;
            }

            Log.d(TAG, "Extracted amount: " + amount + " — sending to backend.");
            sendToBackend(amount, body, token);
        }
    }

    // ── Returns true if the SMS looks like a debit transaction ───────────────
    private boolean isDebitSMS(String sms) {
        String lower = sms.toLowerCase();
        for (String keyword : DEBIT_KEYWORDS) {
            if (lower.contains(keyword)) return true;
        }
        return false;
    }

    // ── Extract payment amount from various bank SMS formats ─────────────────
    //
    //  Handled formats:
    //    Rs.131.00        → "Rs." followed by digits
    //    Rs. 131.00       → "Rs. " followed by digits
    //    INR 131.00       → INR prefix
    //    ₹131.00          → rupee symbol
    //    Rs 131           → no dot after Rs
    //    debited by 500   → "by" prefix
    //    debit of 500.00  → "of" prefix
    //
    private String extractAmount(String sms) {
        try {
            // Priority patterns — currency prefix first
            String[] patterns = {
                // Rs.131.00 or Rs. 131.00 or Rs131
                "[Rr][Ss]\\.?\\s*(\\d+(?:\\.\\d{1,2})?)",
                // INR 131.00
                "[Ii][Nn][Rr]\\.?\\s*(\\d+(?:\\.\\d{1,2})?)",
                // ₹131.00
                "₹\\s*(\\d+(?:\\.\\d{1,2})?)",
                // debited by / paid / amount of / for Rs
                "(?:debited|paid|amount|for)\\s+(?:[Rr][Ss]\\.?\\s*)?(\\d+(?:\\.\\d{1,2})?)",
            };

            for (String pat : patterns) {
                Pattern pattern = Pattern.compile(pat);
                Matcher matcher = pattern.matcher(sms);
                if (matcher.find()) {
                    return matcher.group(1);
                }
            }

        } catch (Exception e) {
            Log.e(TAG, "Amount extraction error: " + e.toString());
        }

        return null;
    }

    // ── POST SMS data to backend with Authorization header ───────────────────
    private void sendToBackend(String amount, String smsText, String token) {

        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                URL url = new URL(BACKEND_URL);
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Authorization", "Bearer " + token);
                conn.setConnectTimeout(10_000);
                conn.setReadTimeout(10_000);
                conn.setDoOutput(true);

                // Build safe JSON manually
                String safeSms = smsText
                        .replace("\\", "\\\\")
                        .replace("\"", "\\\"")
                        .replace("\n", "\\n")
                        .replace("\r", "\\r");

                String json = "{"
                        + "\"amount\": " + amount + ","
                        + "\"sms_text\": \"" + safeSms + "\""
                        + "}";

                OutputStream os = conn.getOutputStream();
                os.write(json.getBytes("UTF-8"));
                os.flush();
                os.close();

                int code = conn.getResponseCode();
                Log.d(TAG, "Backend response code: " + code);

            } catch (Exception e) {
                Log.e(TAG, "Backend send error: " + e.toString());
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
    }
}