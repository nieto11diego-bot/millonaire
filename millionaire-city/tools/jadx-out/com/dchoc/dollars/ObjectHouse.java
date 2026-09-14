package com.dchoc.dollars;

import java.io.DataInputStream;
import java.io.IOException;

/* JADX INFO: loaded from: classes.dex */
public class ObjectHouse {
    public static final int CONTRACT_GROUP_1 = 0;
    public static final int CONTRACT_GROUP_10 = 9;
    public static final int CONTRACT_GROUP_11 = 10;
    public static final int CONTRACT_GROUP_12 = 11;
    public static final int CONTRACT_GROUP_13 = 12;
    public static final int CONTRACT_GROUP_14 = 13;
    public static final int CONTRACT_GROUP_15 = 14;
    public static final int CONTRACT_GROUP_16 = 15;
    public static final int CONTRACT_GROUP_17 = 16;
    public static final int CONTRACT_GROUP_2 = 1;
    public static final int CONTRACT_GROUP_3 = 2;
    public static final int CONTRACT_GROUP_4 = 3;
    public static final int CONTRACT_GROUP_5 = 4;
    public static final int CONTRACT_GROUP_6 = 5;
    public static final int CONTRACT_GROUP_7 = 6;
    public static final int CONTRACT_GROUP_8 = 7;
    public static final int CONTRACT_GROUP_9 = 8;
    private int mAnimationConstructionRid;
    private int mAnimationDamagedRid;
    private int mAnimationDestroyedRid;
    private int mAnimationIdleRid;
    private int mAnimationShopRid;
    private int mBaseColTiles;
    private int mBaseRowTiles;
    private int[] mBuffsAndEvents;
    private int mBuildingNameRid;
    private int mConstructionCoins;
    private int mConstructionFortune;
    private int mConstructionTime;
    private int mContractGroup;
    private SpriteObject mDavinciAnimation;
    private int[] mDavinciAnimationLocation;
    private int mDavinciAnimationRid;
    private int mDescriptionTextRid;
    private int mExp;
    private int mInstantBuildFactor;
    private int mIsForSale;
    private int mLevel;
    private int mObjectId;
    private int mSoundDestroyedRid;

    public ObjectHouse(DataInputStream dataInputStream) throws IOException {
        this.mDavinciAnimationRid = dataInputStream.readInt();
        this.mDavinciAnimationLocation = new int[]{dataInputStream.readInt(), dataInputStream.readInt()};
        this.mObjectId = dataInputStream.readInt();
        this.mBuildingNameRid = dataInputStream.readInt();
        this.mDescriptionTextRid = dataInputStream.readInt();
        this.mLevel = dataInputStream.readInt();
        this.mExp = dataInputStream.readInt();
        this.mBaseRowTiles = dataInputStream.readInt();
        this.mBaseColTiles = dataInputStream.readInt();
        this.mConstructionCoins = dataInputStream.readInt();
        this.mConstructionFortune = dataInputStream.readInt();
        this.mConstructionTime = dataInputStream.readInt();
        this.mInstantBuildFactor = dataInputStream.readInt();
        this.mContractGroup = dataInputStream.readInt();
        this.mIsForSale = dataInputStream.readInt();
        this.mBuffsAndEvents = new int[dataInputStream.readByte()];
        for (int i2 = 0; i2 < this.mBuffsAndEvents.length; i2++) {
            this.mBuffsAndEvents[i2] = dataInputStream.readInt();
        }
        this.mSoundDestroyedRid = dataInputStream.readInt();
        this.mAnimationIdleRid = dataInputStream.readInt();
        this.mAnimationDestroyedRid = dataInputStream.readInt();
        this.mAnimationDamagedRid = dataInputStream.readInt();
        this.mAnimationConstructionRid = dataInputStream.readInt();
        this.mAnimationShopRid = dataInputStream.readInt();
    }

    public int getAnimationConstructionRid() {
        return this.mAnimationConstructionRid;
    }

    public int getAnimationDamagedRid() {
        return this.mAnimationDamagedRid;
    }

    public int getAnimationDestroyedRid() {
        return this.mAnimationDestroyedRid;
    }

    public int getAnimationIdleRid() {
        return this.mAnimationIdleRid;
    }

    public int getAnimationShopRid() {
        return this.mAnimationShopRid;
    }

    public int getBaseColTiles() {
        return this.mBaseColTiles;
    }

    public int getBaseRowTiles() {
        return this.mBaseRowTiles;
    }

    public int[] getBuffsAndEvents() {
        return this.mBuffsAndEvents;
    }

    public int getBuildingNameRid() {
        return this.mBuildingNameRid;
    }

    public int getConstructionCoins() {
        return this.mConstructionCoins;
    }

    public int getConstructionFortune() {
        return this.mConstructionFortune;
    }

    public int getConstructionTime() {
        return this.mConstructionTime;
    }

    public int getContractGroup() {
        return this.mContractGroup;
    }

    public int[] getDavinciAnimationLocation() {
        return this.mDavinciAnimationLocation;
    }

    public int getDavinciAnimationRid() {
        return this.mDavinciAnimationRid;
    }

    public int getDescriptionTextRid() {
        return this.mDescriptionTextRid;
    }

    public int getExp() {
        return this.mExp;
    }

    public int getInstantBuildFactor() {
        return this.mInstantBuildFactor;
    }

    public int getIsForSale() {
        return this.mIsForSale;
    }

    public int getLevel() {
        return this.mLevel;
    }

    public int getObjectId() {
        return this.mObjectId;
    }

    public int getSoundDestroyedRid() {
        return this.mSoundDestroyedRid;
    }

    public SpriteObject getdavinciAnimation() {
        return this.mDavinciAnimation;
    }

    public void loaddavinciAnimation() {
        if (this.mDavinciAnimation == null) {
            this.mDavinciAnimation = new SpriteObject(DavinciUtilities.loadAnimation(this.mDavinciAnimationRid));
        }
    }

    public void setAnimationConstructionRid(int i2) {
        this.mAnimationConstructionRid = i2;
    }

    public void setAnimationDamagedRid(int i2) {
        this.mAnimationDamagedRid = i2;
    }

    public void setAnimationDestroyedRid(int i2) {
        this.mAnimationDestroyedRid = i2;
    }

    public void setAnimationIdleRid(int i2) {
        this.mAnimationIdleRid = i2;
    }

    public void setAnimationShopRid(int i2) {
        this.mAnimationShopRid = i2;
    }

    public void setBaseColTiles(int i2) {
        this.mBaseColTiles = i2;
    }

    public void setBaseRowTiles(int i2) {
        this.mBaseRowTiles = i2;
    }

    public void setBuffsAndEvents(int[] iArr) {
        this.mBuffsAndEvents = iArr;
    }

    public void setBuildingNameRid(int i2) {
        this.mBuildingNameRid = i2;
    }

    public void setConstructionCoins(int i2) {
        this.mConstructionCoins = i2;
    }

    public void setConstructionFortune(int i2) {
        this.mConstructionFortune = i2;
    }

    public void setConstructionTime(int i2) {
        this.mConstructionTime = i2;
    }

    public void setContractGroup(int i2) {
        this.mContractGroup = i2;
    }

    public void setDavinciAnimationLocation(int[] iArr) {
        this.mDavinciAnimationLocation = iArr;
    }

    public void setDescriptionTextRid(int i2) {
        this.mDescriptionTextRid = i2;
    }

    public void setExp(int i2) {
        this.mExp = i2;
    }

    public void setInstantBuildFactor(int i2) {
        this.mInstantBuildFactor = i2;
    }

    public void setIsForSale(int i2) {
        this.mIsForSale = i2;
    }

    public void setLevel(int i2) {
        this.mLevel = i2;
    }

    public void setObjectId(int i2) {
        this.mObjectId = i2;
    }

    public void setSoundDestroyedRid(int i2) {
        this.mSoundDestroyedRid = i2;
    }
}