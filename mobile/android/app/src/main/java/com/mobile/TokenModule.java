package com.mobile;

import android.content.Context;
import android.content.SharedPreferences;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

/**
 * Native module that lets React Native JS save/clear the JWT auth token
 * into Android SharedPreferences so SMSReceiver can access it.
 */
public class TokenModule extends ReactContextBaseJavaModule {

    private static final String PREFS_NAME = "FinanceAppPrefs";
    private static final String KEY_TOKEN  = "auth_token";

    TokenModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "TokenModule";
    }

    // Called from JS after login/register succeeds
    @ReactMethod
    public void saveToken(String token) {
        SharedPreferences prefs = getReactApplicationContext()
                .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_TOKEN, token).apply();
    }

    // Called from JS on logout
    @ReactMethod
    public void clearToken() {
        SharedPreferences prefs = getReactApplicationContext()
                .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().remove(KEY_TOKEN).apply();
    }

    // Utility used by SMSReceiver (static, no React context needed)
    public static String getToken(Context context) {
        SharedPreferences prefs = context
                .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getString(KEY_TOKEN, null);
    }
}
