package com.mobile;   // ⚠️ Make sure this matches your package name

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

                    // 🔍 Extract amount using regex
                    String amount = null;
                    Pattern pattern = Pattern.compile("(\\d+)");
                    Matcher matcher = pattern.matcher(body);

                    if (matcher.find()) {
                        amount = matcher.group(1);
                    }

                    // 🏪 Detect merchant
                    String merchant = "Unknown";

                    if (body.toLowerCase().contains("swiggy"))
                        merchant = "Swiggy";
                    else if (body.toLowerCase().contains("uber"))
                        merchant = "Uber";
                    else if (body.toLowerCase().contains("amazon"))
                        merchant = "Amazon";
                    else if (body.toLowerCase().contains("zomato"))
                        merchant = "Zomato";
                    else if (body.toLowerCase().contains("ola"))
                        merchant = "Ola";

                    // 🚀 Send to backend if valid
                    if (amount != null && !merchant.equals("Unknown")) {
                        sendToBackend(amount, merchant);
                    }
                }
            }
        }
    }

    private void sendToBackend(String amount, String merchant) {

        new Thread(() -> {
            try {

                // ⚠️ Replace with your actual laptop IP
                URL url = new URL("http://172.20.10.2:5000/add-transaction");

                HttpURLConnection conn = (HttpURLConnection) url.openConnection();

                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);

                String json =
                        "{\"amount\": " + amount + ", \"merchant\": \"" + merchant + "\"}";

                OutputStream os = conn.getOutputStream();
                os.write(json.getBytes());
                os.flush();
                os.close();

                int responseCode = conn.getResponseCode();

                Log.d("BACKEND_RESPONSE", "Response Code: " + responseCode);

                conn.disconnect();

            } catch (Exception e) {
                Log.e("SMS_ERROR", e.toString());
            }
        }).start();
    }
}
