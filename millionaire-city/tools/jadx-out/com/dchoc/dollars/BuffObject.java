package com.dchoc.dollars;

import java.io.IOException;

/* JADX INFO: loaded from: classes.dex */
public class BuffObject {
    public static final int DRAWING_PRIORITY_BEHIND_OBJECT = 1000;
    public static final int DRAWING_PRIORITY_IN_FRONT_OF_OBJECT = 3000;
    public static final int DRAWING_PRIORITY_MODIFIES_OBJECT = 2000;
    public static final int DRAWING_PRIORITY_ON_TOP_OF_ALL_OBJECTS = 4000;
    public static final int DRAWING_PRIORITY_UNDER_ALL_OBJECTS = 0;
    private static BuffObject[] smBuffsRecycledStack;
    private static int smBuffsStackSize = 0;
    private int[] mAnimationRidsDefault;
    private int[] mAnimationRidsReplacements;
    private int mArmorAbsolute;
    private int mArmorPercent;
    private int mAttackRange;
    private int mAttackSpeed;
    private int mBuffId;
    private int mDamageMax;
    private int mDamageMin;
    private boolean mDelayUpdate;
    private boolean mDisabled;
    private int mDuration;
    private SpriteObject mEffectAnimation;
    private int mElapsedTime;
    private int mEventActivatedId;
    private int mEventAddedToObjectId;
    private int mEventAttackingId;
    private int mEventBeingAttackedId;
    private int mEventDurationEndId;
    private int mEventEquippedId;
    private int mEventRemovedFromObjectId;
    private int mEventRenderingId;
    private int mEventUnEquippedId;
    private int mMagicalType;
    private int mMovementSpeed;
    private int mPriority;
    private int mRotationSpeed;
    private int mType;

    private BuffObject() {
        resetProperties();
    }

    public static BuffObject New() {
        if (smBuffsRecycledStack == null || smBuffsStackSize == 0) {
            return new BuffObject();
        }
        smBuffsStackSize--;
        BuffObject buffObject = smBuffsRecycledStack[smBuffsStackSize];
        buffObject.resetProperties();
        return buffObject;
    }

    public static void Recycle(BuffObject buffObject) {
        if (smBuffsRecycledStack == null) {
            smBuffsRecycledStack = new BuffObject[32];
        } else if (smBuffsStackSize == smBuffsRecycledStack.length) {
            int length = smBuffsRecycledStack.length;
            BuffObject[] buffObjectArr = new BuffObject[length << 1];
            System.arraycopy(smBuffsRecycledStack, 0, buffObjectArr, 0, length);
            smBuffsRecycledStack = buffObjectArr;
        }
        smBuffsRecycledStack[smBuffsStackSize] = buffObject;
        smBuffsStackSize++;
    }

    public static BuffObject clone(BuffObject buffObject, BuffObject buffObject2) {
        buffObject2.setType(buffObject.getType());
        buffObject2.setBuffId(buffObject.getBuffId());
        buffObject2.setPriority(buffObject.getPriority());
        buffObject2.setEventEquippedId(buffObject.getEventEquippedId());
        buffObject2.setEventUnEquippedId(buffObject.getEventUnEquippedId());
        buffObject2.setEventAddedToObjectId(buffObject.getEventAddedToObjectId());
        buffObject2.setEventRemovedFromObjectId(buffObject.getEventRemovedFromObjectId());
        buffObject2.setEventActivatedId(buffObject.getEventActivatedId());
        buffObject2.setEventRenderingId(buffObject.getEventRenderingId());
        buffObject2.setEventAttackingId(buffObject.getEventAttackingId());
        buffObject2.setEventBeingAttackedId(buffObject.getEventBeingAttackedId());
        buffObject2.setEventDurationEndId(buffObject.getEventDurationEndId());
        buffObject2.setDuration(buffObject.getDuration());
        buffObject2.setElapsedTime(buffObject.getElapsedTime());
        buffObject2.setEffectAnimation(buffObject.getEffectAnimation());
        buffObject2.setAnimationReplacementRids(buffObject.getAnimationRidsDefault(), buffObject.getAnimationRidsReplacements());
        buffObject2.setDefaultMagicalType(buffObject.getDefaultMagicalType());
        buffObject2.setDefaultDamageMin(buffObject.getDefaultDamageMin());
        buffObject2.setDefaultDamageMax(buffObject.getDefaultDamageMax());
        buffObject2.setDefaultArmorAbsolute(buffObject.getDefaultArmorAbsolute());
        buffObject2.setDefaultArmorPercent(buffObject.getDefaultArmorPercent());
        buffObject2.setDefaultAttackRange(buffObject.getDefaultAttackRange());
        buffObject2.setDefaultMovementSpeed(buffObject.getDefaultMovementSpeed());
        buffObject2.setDefaultRotationSpeed(buffObject.getDefaultRotationSpeed());
        buffObject2.setDefaultAttackSpeed(buffObject.getDefaultAttackSpeed());
        return buffObject2;
    }

    private void resetProperties() {
        this.mType = 0;
        this.mBuffId = 0;
        this.mPriority = 0;
        this.mEventEquippedId = -1;
        this.mEventUnEquippedId = -1;
        this.mEventAddedToObjectId = -1;
        this.mEventRemovedFromObjectId = -1;
        this.mEventActivatedId = -1;
        this.mEventRenderingId = -1;
        this.mEventAttackingId = -1;
        this.mEventBeingAttackedId = -1;
        this.mEventDurationEndId = -1;
        this.mDisabled = false;
        this.mDuration = 0;
        this.mElapsedTime = 0;
        this.mEffectAnimation = null;
        this.mAnimationRidsDefault = null;
        this.mAnimationRidsReplacements = null;
        this.mMagicalType = 0;
        this.mDamageMin = 0;
        this.mDamageMax = 0;
        this.mArmorAbsolute = 0;
        this.mArmorPercent = 0;
        this.mAttackRange = 0;
        this.mMovementSpeed = 100;
        this.mRotationSpeed = 100;
        this.mAttackSpeed = 100;
        this.mDelayUpdate = false;
    }

    public void delayUpdate() {
        this.mDelayUpdate = true;
    }

    public void disable() {
        this.mDisabled = true;
    }

    public void eventActivated() {
        if (this.mEventActivatedId != -1) {
            BuffScript.setBuff(this);
            BuffScript.event(this.mEventActivatedId);
        }
    }

    public void eventAddedToObject() {
        if (this.mEventAddedToObjectId != -1) {
            BuffScript.setBuff(this);
            BuffScript.event(this.mEventAddedToObjectId);
        }
    }

    public void eventEquipped() {
        if (this.mEventEquippedId != -1) {
            BuffScript.setBuff(this);
            BuffScript.event(this.mEventEquippedId);
        }
    }

    public void eventRemovedFromObject() {
        if (this.mEventRemovedFromObjectId != -1) {
            BuffScript.setBuff(this);
            BuffScript.event(this.mEventRemovedFromObjectId);
        }
    }

    public void eventRenderingEffect(DirectionalSpriteObject directionalSpriteObject, int i2, int i3, int i4) {
        if (this.mEventRenderingId != -1) {
            BuffScript.setupGameObjectDrawing(directionalSpriteObject, i2, i3, i4, this.mEffectAnimation);
            BuffScript.setBuff(this);
            BuffScript.event(this.mEventRenderingId);
        }
    }

    public void eventUnEquipped() {
        if (this.mEventUnEquippedId != -1) {
            BuffScript.setBuff(this);
            BuffScript.event(this.mEventUnEquippedId);
        }
    }

    public void gestureOccurred(GestureEvent gestureEvent, GameObject gameObject) {
        BuffScript.setBuff(this);
        BuffScript.setGameObject(gameObject);
        BuffScript.gestureOccurred(gestureEvent, gameObject, this);
    }

    public int[] getAnimationRidsDefault() {
        return this.mAnimationRidsDefault;
    }

    public int[] getAnimationRidsReplacements() {
        return this.mAnimationRidsReplacements;
    }

    public int getBuffId() {
        return this.mBuffId;
    }

    public int getCurrentArmorAbsolute() {
        BuffScript.setBuff(this);
        return BuffScript.getCurrentArmorAbsolute();
    }

    public int getCurrentArmorPercent() {
        BuffScript.setBuff(this);
        return BuffScript.getCurrentArmorPercent();
    }

    public int getCurrentAttackRange() {
        BuffScript.setBuff(this);
        return BuffScript.getCurrentAttackRange();
    }

    public int getCurrentAttackSpeed() {
        BuffScript.setBuff(this);
        return BuffScript.getCurrentAttackSpeed();
    }

    public int getCurrentDamageMax() {
        BuffScript.setBuff(this);
        return BuffScript.getCurrentDamageMax();
    }

    public int getCurrentDamageMin() {
        BuffScript.setBuff(this);
        return BuffScript.getCurrentDamageMin();
    }

    public int getCurrentMagicalType() {
        BuffScript.setBuff(this);
        return BuffScript.getCurrentMagicalType();
    }

    public int getCurrentMovementSpeed() {
        BuffScript.setBuff(this);
        return BuffScript.getCurrentMovementSpeed();
    }

    public int getCurrentRotationSpeed() {
        BuffScript.setBuff(this);
        return BuffScript.getCurrentRotationSpeed();
    }

    public int getDefaultArmorAbsolute() {
        return this.mArmorAbsolute;
    }

    public int getDefaultArmorPercent() {
        return this.mArmorPercent;
    }

    public int getDefaultAttackRange() {
        return this.mAttackRange;
    }

    public int getDefaultAttackSpeed() {
        return this.mAttackSpeed;
    }

    public int getDefaultDamageMax() {
        return this.mDamageMax;
    }

    public int getDefaultDamageMin() {
        return this.mDamageMin;
    }

    public int getDefaultMagicalType() {
        return this.mMagicalType;
    }

    public int getDefaultMovementSpeed() {
        return this.mMovementSpeed;
    }

    public int getDefaultRotationSpeed() {
        return this.mRotationSpeed;
    }

    public int getDuration() {
        return this.mDuration;
    }

    public SpriteObject getEffectAnimation() {
        return this.mEffectAnimation;
    }

    public int getElapsedTime() {
        return this.mElapsedTime;
    }

    public int getEventActivatedId() {
        return this.mEventActivatedId;
    }

    public int getEventAddedToObjectId() {
        return this.mEventAddedToObjectId;
    }

    public int getEventAttackingId() {
        return this.mEventAttackingId;
    }

    public int getEventBeingAttackedId() {
        return this.mEventBeingAttackedId;
    }

    public int getEventDurationEndId() {
        return this.mEventDurationEndId;
    }

    public int getEventEquippedId() {
        return this.mEventEquippedId;
    }

    public int getEventRemovedFromObjectId() {
        return this.mEventRemovedFromObjectId;
    }

    public int getEventRenderingId() {
        return this.mEventRenderingId;
    }

    public int getEventUnEquippedId() {
        return this.mEventUnEquippedId;
    }

    public int getPriority() {
        return this.mPriority;
    }

    public int getType() {
        return this.mType;
    }

    public boolean isDisabled() {
        return this.mDisabled;
    }

    public void keepAlive() {
        setElapsedTime(0);
    }

    public void loadRecordStore(DChocByteArray dChocByteArray) {
        try {
            if (dChocByteArray.readBoolean()) {
                disable();
            }
            setElapsedTime(dChocByteArray.readInt());
            setDuration(dChocByteArray.readInt());
            if (this.mBuffId < 58 || this.mBuffId > 61 || ApplicationStates.smIsGamePlayRestored) {
                return;
            }
            setDuration(-1);
        } catch (IOException e2) {
            e2.printStackTrace();
        }
    }

    public void logicUpdate(int i2) {
        if (this.mDisabled) {
            return;
        }
        if (this.mDelayUpdate) {
            this.mDelayUpdate = false;
            return;
        }
        if (this.mElapsedTime < this.mDuration || this.mDuration <= 0) {
            this.mElapsedTime += i2;
            if (this.mElapsedTime < this.mDuration || this.mDuration <= 0) {
                if (this.mElapsedTime < 0) {
                    this.mElapsedTime = 0;
                    return;
                }
                return;
            }
            if (this.mEventDurationEndId != -1) {
                BuffScript.setBuff(this);
                BuffScript.event(this.mEventDurationEndId);
            }
            if (this.mElapsedTime >= this.mDuration) {
                eventRemovedFromObject();
                disable();
            }
        }
    }

    public void saveRecordStore(DChocByteArray dChocByteArray) {
        dChocByteArray.writeBoolean(isDisabled());
        dChocByteArray.writeInt(getElapsedTime());
        dChocByteArray.writeInt(getDuration());
    }

    public void setAnimationReplacementRids(int[] iArr, int[] iArr2) {
        this.mAnimationRidsDefault = iArr;
        this.mAnimationRidsReplacements = iArr2;
    }

    public void setBuffId(int i2) {
        this.mBuffId = i2;
    }

    public void setDefaultArmorAbsolute(int i2) {
        this.mArmorAbsolute = i2;
    }

    public void setDefaultArmorPercent(int i2) {
        this.mArmorPercent = i2;
    }

    public void setDefaultAttackRange(int i2) {
        this.mAttackRange = i2;
    }

    public void setDefaultAttackSpeed(int i2) {
        this.mAttackSpeed = i2;
    }

    public void setDefaultDamageMax(int i2) {
        this.mDamageMax = i2;
    }

    public void setDefaultDamageMin(int i2) {
        this.mDamageMin = i2;
    }

    public void setDefaultMagicalType(int i2) {
        this.mMagicalType = i2;
    }

    public void setDefaultMovementSpeed(int i2) {
        this.mMovementSpeed = i2;
    }

    public void setDefaultRotationSpeed(int i2) {
        this.mRotationSpeed = i2;
    }

    public void setDuration(int i2) {
        this.mDuration = i2;
    }

    public void setEffectAnimation(SpriteObject spriteObject) {
        this.mEffectAnimation = spriteObject;
    }

    public void setElapsedTime(int i2) {
        this.mElapsedTime = i2;
    }

    public void setEventActivatedId(int i2) {
        this.mEventActivatedId = i2;
    }

    public void setEventAddedToObjectId(int i2) {
        this.mEventAddedToObjectId = i2;
    }

    public void setEventAttackingId(int i2) {
        this.mEventAttackingId = i2;
    }

    public void setEventBeingAttackedId(int i2) {
        this.mEventBeingAttackedId = i2;
    }

    public void setEventDurationEndId(int i2) {
        this.mEventDurationEndId = i2;
    }

    public void setEventEquippedId(int i2) {
        this.mEventEquippedId = i2;
    }

    public void setEventRemovedFromObjectId(int i2) {
        this.mEventRemovedFromObjectId = i2;
    }

    public void setEventRenderingId(int i2) {
        this.mEventRenderingId = i2;
    }

    public void setEventUnEquippedId(int i2) {
        this.mEventUnEquippedId = i2;
    }

    public void setPriority(int i2) {
        this.mPriority = i2;
    }

    public void setType(int i2) {
        this.mType = i2;
    }
}