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

    @Override
    public void onReceive(Context context, Intent intent) {

        Bundle bundle = intent.getExtras();

        if (bundle != null) {

            Object[] pdus = (Object[]) bundle.get("pdus");

            if (pdus != null) {

                for (Object pdu : pdus) {

                    SmsMessage message = SmsMessage.createFromPdu((byte[]) pdu);

                    String body = message.getMessageBody();

                    Log.d("SMS_RECEIVED", body);

                    // Extract amount
                    String amount = extractAmount(body);

                    if (amount != null) {
                        sendToBackend(amount, body);
                    }
                }
            }
        }
    }

    // ------------------------------
    // Extract transaction amount
    // ------------------------------
    private String extractAmount(String sms) {

        try {

            Pattern pattern = Pattern.compile("(\\d+\\.\\d{2}|\\d+)");
            Matcher matcher = pattern.matcher(sms);

            if (matcher.find()) {
                return matcher.group(1);
            }

        } catch (Exception e) {
            Log.e("AMOUNT_ERROR", e.toString());
        }

        return null;
    }

    // ------------------------------
    // Send SMS data to backend
    // ------------------------------
    private void sendToBackend(String amount, String smsText) {

        new Thread(() -> {

            try {

                // Replace with your backend IP
                URL url = new URL("http://192.168.11.137:5000/process-sms");

                HttpURLConnection conn = (HttpURLConnection) url.openConnection();

                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);

                // Escape quotes safely (cannot modify smsText inside lambda)
                String safeSmsText = smsText.replace("\"", "\\\"");

                String json =
                        "{"
                        + "\"amount\": " + amount + ","
                        + "\"sms_text\": \"" + safeSmsText + "\""
                        + "}";

                OutputStream os = conn.getOutputStream();
                os.write(json.getBytes());
                os.flush();
                os.close();

                int responseCode = conn.getResponseCode();

                Log.d("BACKEND_RESPONSE", "Response Code: " + responseCode);

                conn.disconnect();

            } catch (Exception e) {

                Log.e("SMS_BACKEND_ERROR", e.toString());

            }

        }).start();
    }
}