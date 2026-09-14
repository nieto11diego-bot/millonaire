package com.dchoc.dollars;

import java.io.DataInputStream;
import java.io.IOException;

/* JADX INFO: loaded from: classes.dex */
public class ObjectCityExpansion {
    private int mAnimationIdleRid;
    private int mBuyEventId;
    private int mCostCoins;
    private int mCostFortune;
    private int[] mLocation;
    private int mObjectId;

    public ObjectCityExpansion(DataInputStream dataInputStream) throws IOException {
        this.mLocation = new int[]{dataInputStream.readInt(), dataInputStream.readInt(), dataInputStream.readInt(), dataInputStream.readInt()};
        this.mObjectId = dataInputStream.readInt();
        this.mCostCoins = dataInputStream.readInt();
        this.mCostFortune = dataInputStream.readInt();
        this.mBuyEventId = dataInputStream.readInt();
        this.mAnimationIdleRid = dataInputStream.readInt();
    }

    public int getAnimationIdleRid() {
        return this.mAnimationIdleRid;
    }

    public int getBuyEventId() {
        return this.mBuyEventId;
    }

    public int getCostCoins() {
        return this.mCostCoins;
    }

    public int getCostFortune() {
        return this.mCostFortune;
    }

    public int[] getLocation() {
        return this.mLocation;
    }

    public int getObjectId() {
        return this.mObjectId;
    }

    public void setAnimationIdleRid(int i2) {
        this.mAnimationIdleRid = i2;
    }

    public void setBuyEventId(int i2) {
        this.mBuyEventId = i2;
    }

    public void setCostCoins(int i2) {
        this.mCostCoins = i2;
    }

    public void setCostFortune(int i2) {
        this.mCostFortune = i2;
    }

    public void setLocation(int[] iArr) {
        this.mLocation = iArr;
    }

    public void setObjectId(int i2) {
        this.mObjectId = i2;
    }
}