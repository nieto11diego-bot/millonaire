package com.dchoc.dollars;

import java.io.IOException;

/* JADX INFO: loaded from: classes.dex */
public class GameObject {
    public static final int BASE_ANGULAR_ROTATION = 35;
    private static final boolean DEBUG_ACTIVE = false;
    private static final boolean DEBUG_ANGLE_VALUE = false;
    private static final boolean DEBUG_BUFFS = false;
    private static final boolean DEBUG_BUFFS_REMAINING_TIME = false;
    private static final boolean DEBUG_CALCULATED_INFLUENCE = false;
    private static final boolean DEBUG_COLLISION_AREAS = false;
    private static final int DEBUG_COLLISION_COLOR = 16728319;
    private static final boolean DEBUG_CONSTRUCTION = false;
    private static final boolean DEBUG_ID = false;
    private static final boolean DEBUG_LINK_TARGET_OWNER = false;
    private static final boolean DEBUG_MOVEMENT_VECTOR = false;
    private static final boolean DEBUG_OBJECT_HEIGHT = false;
    private static final boolean DEBUG_ROAD_CONNECTION = false;
    private static final boolean DEBUG_STATE = false;
    private static final boolean DEBUG_STATE_FROZEN = false;
    private static final boolean DEBUG_TARGET = false;
    private static final boolean DEBUG_TYPE = false;
    private static final boolean DEBUG_UNIQUE_SIGNATURE = false;
    private static final int DELAY_SOLDIER_SEARCH_ENEMY = 600;
    private static final int INFLUENCE_VALUE_PERCENTAGE = 10000;
    private static final int MAX_DURATION_TRYING_TO_REACH_TARGET = 1000;
    private static final int MAX_ENGAGING_DURATION = 4000;
    private static final int MAX_SPEED = 70000;
    private static final int MIN_SPEED_TO_RUN = 6000;
    public static final int RESPAWN_TIME = -1;
    private static final int SOLDIER_VISION = 9000;
    public static final int STATE_ATTACK_PREP = 202;
    public static final int STATE_ATTACK_RECOIL = 203;
    public static final int STATE_CASTING = 205;
    public static final int STATE_CONSTRUCTION = 3;
    public static final int STATE_CONSTRUCTION_DONE = 4;
    public static final int STATE_DEATH = 2;
    public static final int STATE_DISABLED = 0;
    public static final int STATE_ENGAGING = 200;
    public static final int STATE_IDLE = 1;
    public static final int STATE_MOVING_AWAY_FROM = 9;
    public static final int STATE_MOVING_TO_LOCATION = 8;
    public static final int STATE_PLACING = 11;
    public static final int STATE_SEARCH_FOR_ENEMY = 10;
    public static final int STATE_TALKING = 206;
    public static final int STATE_TRIGGER = 100;
    public static final int STATE_TURN_TOWARDS_LOCATION = 7;
    public static final int SUBTYPE_CITY_EXPANSION = 6;
    public static final int SUBTYPE_COMERCE = 2;
    public static final int SUBTYPE_DECO = 3;
    public static final int SUBTYPE_HOUSE = 1;
    public static final int SUBTYPE_HQ = 5;
    public static final int SUBTYPE_WONDER = 4;
    public static final int THREE_DAY_CONTRACT_INDEX = 8;
    private static final int TOTAL_ANIMATION_COUNT = 8;
    private static final int TOUCH_DISTANCE_DO_NOTHING = 1300;
    private static final int TOUCH_DISTANCE_ROTATION_ONLY = 2900;
    public static final int TYPE_BUILDING = 16;
    public static final int TYPE_COLLECTIBLE = 8;
    public static final int TYPE_HERO = 1;
    public static final int TYPE_MEMORY_DUMMY = 256;
    public static final int TYPE_PLACE_INDICATOR = 4;
    public static final int TYPE_RECTANGULAR_TRIGGER = 128;
    public static final int TYPE_SOLDIER = 2;
    public static final int TYPE_TREASURE = 32;
    public static final int TYPE_TRIGGER = 64;
    private static GameObject[] smInstanceRecycledStack;
    private boolean mActive;
    private DirectionalSpriteObject mAnimationAttackPrep;
    private DirectionalSpriteObject mAnimationAttackRecoil;
    private DirectionalSpriteObject mAnimationConstruction;
    private DirectionalSpriteObject mAnimationDamaged;
    private int mAnimationDeltaTime;
    private DirectionalSpriteObject mAnimationDestroyed;
    private DirectionalSpriteObject mAnimationIdle;
    private int[][] mAnimationRids;
    private DirectionalSpriteObject mAnimationRunning;
    private DirectionalSpriteObject mAnimationTalking;
    private int mAttackCooldownCurrent;
    private int mAttackCooldownMax;
    private int mAttackPrepTime;
    private int mAttackRecoilTime;
    private BuffObject[] mBuffs;
    private int mBuffsCount;
    private int mCalculatedInfluenceValue;
    private boolean mCollidable;
    private int mColorFilter;
    private int mConstructionCostCoins;
    private int mConstructionCostFortunePoints;
    private int mConstructionTime;
    private int mConstructionTimeRemaining;
    private int mContractGroup;
    private int mContractID;
    private DirectionalSpriteObject mCurrentAnimation;
    private boolean mDvcCollisionBoxes;
    private int mEXP;
    private int mElapsedAnimationTime;
    private int mElapsedTime;
    private boolean mEngageable;
    private IRpgEngine mEngine;
    private int mEventId;
    private int mForSale;
    private boolean mFrozen;
    private int mHeight;
    private int mIncomeTime;
    private int mIncomeValue;
    private int mIncomeXP;
    private boolean mIndestructible;
    private int mInfluenceRadius;
    private int mInfluenceValue;
    private int mInhabitants;
    private int mInstantBuildFactor;
    private boolean mIsOnScreen;
    private int mLevelToUnlock;
    private int mLifeTime;
    private boolean mLoadingComplete;
    private boolean mMovable;
    private int mObjectId;
    private boolean mOccupiesSpace;
    private GameObject mOwner;
    private boolean mPermanent;
    private float mPlaterStartPositionY;
    private float mPlayerStartPositionX;
    private float mPosX;
    private float mPosY;
    private int mPreviousState;
    private TileData mRoadConnection;
    private boolean mRunPhysicsAfter;
    private int mState;
    private int mSubType;
    private GameObject mTarget;
    private int mTargetLevelId;
    private int mTargetObjectId;
    private int mTeam;
    private int mTempScreenX;
    private int mTempScreenY;
    private int mTileX;
    private int mTileY;
    private int mTimer;
    private int mType;
    private int mUniqueSignature;
    private int mValue;
    private int mWidth;
    private static DirectionalSpriteObject[] smWorkArray = new DirectionalSpriteObject[8];
    private static int smInstanceStackSize = 0;
    private int mCurrentSoundEffect = -1;
    private int mSoundEffectDeath = -1;
    private int mShopAnimationRid = -1;
    private int mNameTID = -1;
    private int mDescriptionTID = -1;
    private boolean mUpdatingBuffsAtTheMoment = false;
    int worldMoveState = -1;
    int delayKeyMovements = 0;

    private GameObject() {
    }

    public static GameObject New(int i2) {
        GameObject gameObject;
        if (smInstanceStackSize == 0) {
            gameObject = new GameObject();
        } else {
            smInstanceStackSize--;
            gameObject = smInstanceRecycledStack[smInstanceStackSize];
            smInstanceRecycledStack[smInstanceStackSize] = null;
        }
        gameObject.reset(i2);
        return gameObject;
    }

    public static void Recycle(GameObject gameObject) {
        if (gameObject == null) {
            return;
        }
        if (smInstanceRecycledStack == null) {
            smInstanceRecycledStack = new GameObject[32];
        } else if (smInstanceStackSize == smInstanceRecycledStack.length) {
            int length = smInstanceRecycledStack.length;
            GameObject[] gameObjectArr = new GameObject[length << 1];
            System.arraycopy(smInstanceRecycledStack, 0, gameObjectArr, 0, length);
            smInstanceRecycledStack = gameObjectArr;
        }
        gameObject.unloadAnimations();
        gameObject.resetReferences();
        smInstanceRecycledStack[smInstanceStackSize] = gameObject;
        smInstanceStackSize++;
    }

    public static final GameObject clone(GameObject gameObject, GameObject gameObject2) {
        gameObject2.setAnimationRids(gameObject.getAnimationRids());
        gameObject2.loadAnimations();
        while (DavinciUtilities.getAdditionalLoadingCount() > 0) {
            DavinciUtilities.loadNext();
        }
        gameObject2.setType(gameObject.getType());
        gameObject2.setSubType(gameObject.getSubType());
        gameObject2.setState(gameObject.getState());
        gameObject2.setElapsedTime(gameObject.getElapsedTime());
        gameObject2.setLifetime(gameObject.getLifetime());
        gameObject2.setConstructionTimeRemaining(gameObject.getConstructionTimeRemaining());
        gameObject2.setFrozen(gameObject.isFrozen());
        gameObject2.setInfluenceRadius(gameObject.getInfluenceRadius());
        gameObject2.setHeight(gameObject.getHeight());
        gameObject2.setWidth(gameObject.getWidth());
        gameObject2.setConstructionCostFortunePoints(gameObject.getConstructionCostFortunePoints());
        gameObject2.setInstantBuildFactor(gameObject.getInstantBuildFactor());
        gameObject2.setEXP(gameObject.getEXP());
        gameObject2.setConstructionTime(gameObject.getConstructionTime());
        gameObject2.setConstructionCostCoins(gameObject.getConstructionCostCoins());
        gameObject2.setValue(gameObject.getValue());
        gameObject2.setColorFilter(gameObject.getColorFilter());
        gameObject2.setPermanent(gameObject.isPermanent());
        gameObject2.setActive(gameObject.isActive());
        gameObject2.setMovable(gameObject.isMovable());
        gameObject2.setCollidable(gameObject.isCollidable());
        gameObject2.setOccupiesSpace(gameObject.isOccupiesSpace());
        gameObject2.setIndestructible(gameObject.isIndestructible());
        gameObject2.setEngageable(gameObject.isEngageable());
        gameObject2.setCollisionBoxesUsed(gameObject.isCollisionBoxesUsed());
        gameObject2.setPos(gameObject.getX(), gameObject.getY());
        gameObject2.setContractGroup(gameObject.getContractGroup());
        gameObject2.setContractID(gameObject.getContractID());
        gameObject2.setTilePos(gameObject.getTileX(), gameObject.getTileY());
        gameObject2.setInfluenceValue(gameObject.getInfluenceValue());
        gameObject2.setIncomeTime(gameObject.getIncomeTime());
        gameObject2.setIncomeXP(gameObject.getIncomeXP());
        gameObject2.setIncomeValue(gameObject.getIncomeValue());
        gameObject2.setForSale(gameObject.getForSale());
        gameObject2.setObjectId(gameObject.getObjectId());
        gameObject2.setTeam(gameObject.getTeam());
        gameObject2.setEventId(gameObject.getEventId());
        gameObject2.setTargetObjectId(gameObject.getTargetObjectId());
        gameObject2.setTargetLevelId(gameObject.getTargetLevelId());
        gameObject2.setTimer(gameObject.getTimer());
        gameObject2.setLevelToUnlock(gameObject.getLevelToUnlock());
        gameObject2.setInhabitants(gameObject.getInhabitants());
        BuffObject[] buffs = gameObject.getBuffs();
        if (buffs != null) {
            for (int i2 = 0; i2 < gameObject.getBuffsCount(); i2++) {
                gameObject2.addBuffClone(buffs[i2]);
            }
        }
        gameObject2.setAttackPrepTime(gameObject.getAttackPrepTime());
        gameObject2.setAttackRecoilTime(gameObject.getAttackDuration());
        gameObject2.setAttackCooldownMax(gameObject.getAttackCooldownMax());
        gameObject2.setSoundDeath(gameObject.getSoundDeath());
        gameObject2.setNameTID(gameObject.getNameTID());
        gameObject2.setDescriptionTID(gameObject.getDescriptionTID());
        gameObject2.setOwner(gameObject.getOwner());
        gameObject2.setUniqueSignature(gameObject.getUniqueSignature());
        return gameObject2;
    }

    private DirectionalSpriteObject getAnimationForState(int i2) {
        switch (i2) {
            case 1:
            case 8:
            case 9:
            case 11:
            case 200:
                return this.mIncomeValue < MIN_SPEED_TO_RUN ? this.mAnimationIdle : this.mAnimationRunning;
            case 2:
                return this.mAnimationDestroyed;
            case 3:
            case 4:
            case 205:
                return this.mAnimationConstruction;
            case 202:
                return this.mAnimationAttackPrep;
            case 203:
                return this.mAnimationAttackRecoil;
            case 206:
                return this.mAnimationTalking;
            default:
                return this.mAnimationIdle;
        }
    }

    private int getSoundDeath() {
        return this.mSoundEffectDeath;
    }

    private int getSoundEffectForState(int i2) {
        switch (i2) {
            case 2:
                return this.mSoundEffectDeath;
            default:
                return -1;
        }
    }

    private boolean moveTowards(int i2, int i3, int i4) {
        return updateAngle(i2, Utils.getAngleMathUtilsBase(i3, i4)) < 11520;
    }

    private void shootProjectileAt(GameObject gameObject) {
    }

    private int updateAngle(int i2, int i3) {
        return 0;
    }

    private void updateAnimation() {
        DirectionalSpriteObject directionalSpriteObject = this.mCurrentAnimation;
        if (directionalSpriteObject != null) {
            int animationLength = this.mElapsedAnimationTime;
            switch (this.mState) {
                case 202:
                    if (this.mAttackPrepTime != 0) {
                        animationLength = (animationLength * directionalSpriteObject.getAnimationLength()) / this.mAttackPrepTime;
                    } else {
                        System.err.println("[WARNING] Avoided division by zero at GameObject.updateAnimation(): mAttackPrepTime == 0");
                        animationLength = directionalSpriteObject.getAnimationLength();
                    }
                    break;
            }
            directionalSpriteObject.setElapsedTime(animationLength);
            this.mElapsedAnimationTime += this.mAnimationDeltaTime;
            this.mElapsedAnimationTime %= directionalSpriteObject.getAnimationLength();
            this.mAnimationDeltaTime = 0;
        }
    }

    private void updateBuffs(int i2) {
        if (this.mBuffs == null || isDead()) {
            return;
        }
        this.mUpdatingBuffsAtTheMoment = true;
        for (int i3 = 0; i3 < this.mBuffsCount; i3++) {
            BuffObject buffObject = this.mBuffs[i3];
            BuffScript.setGameObject(this);
            buffObject.logicUpdate(i2);
        }
        int i4 = 0;
        int i5 = 0;
        while (i4 < this.mBuffsCount) {
            BuffObject buffObject2 = this.mBuffs[i4];
            if (i5 > 0) {
                this.mBuffs[i4] = this.mBuffs[i4 + i5];
                this.mBuffs[i4 + i5] = null;
                buffObject2 = this.mBuffs[i4];
            }
            if (buffObject2.isDisabled()) {
                BuffObject.Recycle(buffObject2);
                i5++;
                i4--;
                this.mBuffsCount--;
            }
            i4++;
        }
        this.mUpdatingBuffsAtTheMoment = false;
    }

    public void actionPressed() {
    }

    public void actionReleased() {
    }

    public void actionRepeated() {
    }

    public BuffObject addBuffClone(BuffObject buffObject) {
        return addBuffClone(buffObject, false);
    }

    public BuffObject addBuffClone(BuffObject buffObject, boolean z) {
        if (buffObject == null) {
            return null;
        }
        BuffScript.buffAdded(this, buffObject);
        if (this.mBuffs == null) {
            this.mBuffs = new BuffObject[4];
            this.mBuffsCount = 0;
        } else {
            for (int i2 = 0; i2 < this.mBuffsCount; i2++) {
                BuffObject buffObject2 = this.mBuffs[i2];
                if (!buffObject2.isDisabled() && buffObject2.getBuffId() == buffObject.getBuffId()) {
                    buffObject2.setDuration(buffObject.getDuration());
                    return !z ? buffObject2 : buffObject;
                }
            }
        }
        BuffObject buffObjectNew = BuffObject.New();
        BuffObject.clone(buffObject, buffObjectNew);
        if (this.mUpdatingBuffsAtTheMoment) {
            buffObjectNew.delayUpdate();
        }
        if (this.mBuffs.length == this.mBuffsCount) {
            int i3 = this.mBuffsCount;
            BuffObject[] buffObjectArr = new BuffObject[i3 << 1];
            System.arraycopy(this.mBuffs, 0, buffObjectArr, 0, i3);
            this.mBuffs = buffObjectArr;
        }
        this.mBuffs[this.mBuffsCount] = buffObjectNew;
        for (int i4 = this.mBuffsCount - 1; i4 >= 0 && buffObjectNew.getPriority() < this.mBuffs[i4].getPriority(); i4--) {
            this.mBuffs[i4 + 1] = this.mBuffs[i4];
            this.mBuffs[i4] = buffObjectNew;
        }
        this.mBuffsCount++;
        BuffScript.setGameObject(this);
        buffObjectNew.eventAddedToObject();
        return buffObjectNew;
    }

    public void behaviorBeginConstruction() {
        changeState(3);
    }

    public void behaviorCast(int i2) {
        this.mTimer = i2;
        changeState(205);
    }

    public void behaviorDie() {
        if (this.mType == 64 || this.mType == 256) {
            new Exception("[ERROR] Trigger cannot use behaviorDie()").printStackTrace();
            return;
        }
        this.mEngine.generateGameObjectEvent(3, this);
        setOccupiesSpace(false);
        setFrozen(false);
        changeState(2);
    }

    public void behaviorPlacingBuilding() {
        changeState(11);
    }

    public void behaviorTalk(int i2) {
        this.mTimer = i2;
        changeState(206);
    }

    public void changeState(int i2) {
        DirectionalSpriteObject animationForState = getAnimationForState(i2);
        if (animationForState != null && animationForState != this.mCurrentAnimation) {
            this.mCurrentAnimation = animationForState;
            this.mCurrentAnimation.setAnimationFrame(0);
            this.mElapsedAnimationTime = 0;
            this.mAnimationDeltaTime = 0;
        }
        int soundEffectForState = getSoundEffectForState(i2);
        if (soundEffectForState != this.mCurrentSoundEffect) {
            this.mCurrentSoundEffect = soundEffectForState;
        }
        switch (i2) {
            case 0:
                this.mIsOnScreen = false;
                break;
            case 2:
                if (this.mEngine != null) {
                    this.mEngine.generateGameObjectEvent(11, this);
                }
                break;
            case 3:
                setConstructionTimeRemaining(getConstructionTime());
                break;
        }
        this.mPreviousState = this.mState;
        this.mState = i2;
        this.mElapsedTime = 0;
    }

    public void disable() {
        if (this.mTarget != null && this.mTarget.getType() == 256 && this.mTarget.getOwner() == this) {
            this.mTarget.disable();
            this.mTarget = null;
        }
        changeState(0);
    }

    public void downPressed() {
    }

    public void downReleased() {
    }

    public void drawBuffOnTopOfAllObjects(IRenderingPlatform iRenderingPlatform) {
        int i2 = this.mTempScreenX;
        int i3 = this.mTempScreenY;
        int iConvertMeasurmentToScreenX = this.mEngine.getCamera().convertMeasurmentToScreenX((getWidth() * this.mEngine.getTileWidth()) >> 1);
        int iConvertMeasurmentToScreenY = this.mEngine.getCamera().convertMeasurmentToScreenY((getHeight() * this.mEngine.getTileHeight()) >> 1);
        if (this.mBuffs == null || isDead() || this.mState == 11) {
            return;
        }
        for (int i4 = 0; i4 < this.mBuffsCount; i4++) {
            BuffObject buffObject = this.mBuffs[i4];
            if (buffObject.getPriority() >= 3000) {
                BuffScript.setGameObject(this);
                buffObject.eventRenderingEffect(this.mCurrentAnimation, i2 + iConvertMeasurmentToScreenX, i3 + iConvertMeasurmentToScreenY, this.mInfluenceValue);
            }
        }
    }

    public void drawBuffUnderUnderAllObjects() {
        if (!this.mIsOnScreen || this.mBuffsCount == 0 || this.mState == 11 || this.mBuffs == null || isDead()) {
            return;
        }
        for (int i2 = 0; i2 < this.mBuffsCount; i2++) {
            BuffObject buffObject = this.mBuffs[i2];
            if (buffObject.getType() == 1) {
                if (buffObject.getPriority() < 0 || buffObject.getPriority() >= 1000) {
                    return;
                }
                BuffScript.setGameObject(this);
                buffObject.eventRenderingEffect(this.mCurrentAnimation, this.mTempScreenX, this.mTempScreenY, this.mInfluenceValue);
            }
        }
    }

    public void drawDebugInformation(IRenderingPlatform iRenderingPlatform, Camera2D camera2D) {
        camera2D.convertToScreenX(this.mPosX);
        camera2D.convertToScreenY(this.mPosY);
        DirectionalSpriteObject directionalSpriteObject = this.mCurrentAnimation;
    }

    public void drawObject(IRenderingPlatform iRenderingPlatform) {
        if (this.mIsOnScreen) {
            DirectionalSpriteObject directionalSpriteObject = this.mCurrentAnimation;
            int i2 = this.mTempScreenX;
            int i3 = this.mTempScreenY;
            int iConvertMeasurmentToScreenX = this.mEngine.getCamera().convertMeasurmentToScreenX((getWidth() * this.mEngine.getTileWidth()) >> 1);
            int iConvertMeasurmentToScreenY = this.mEngine.getCamera().convertMeasurmentToScreenY((getHeight() * this.mEngine.getTileHeight()) >> 1);
            updateAnimation();
            int i4 = 0;
            if (this.mBuffs != null && this.mBuffsCount > 0 && !isDead() && this.mState != 11) {
                while (i4 < this.mBuffsCount) {
                    BuffObject buffObject = this.mBuffs[i4];
                    if (buffObject.getPriority() >= 1000) {
                        if (buffObject.getPriority() >= 2000) {
                            break;
                        }
                        BuffScript.setGameObject(this);
                        buffObject.eventRenderingEffect(directionalSpriteObject, i2 + iConvertMeasurmentToScreenX, i3 + iConvertMeasurmentToScreenY, this.mInfluenceValue);
                    }
                    i4++;
                }
            }
            boolean z = false;
            int blurWidth = iRenderingPlatform.getBlurWidth();
            int blurHeight = iRenderingPlatform.getBlurHeight();
            int colorModification = iRenderingPlatform.getColorModification();
            int scaleWidth = iRenderingPlatform.getScaleWidth();
            int scaleHeight = iRenderingPlatform.getScaleHeight();
            if (this.mColorFilter != -8355712) {
                z = true;
                iRenderingPlatform.setColorModification(this.mColorFilter);
            }
            if (this.mBuffs != null && this.mBuffsCount > 0 && !isDead() && this.mState != 11) {
                while (i4 < this.mBuffsCount) {
                    BuffObject buffObject2 = this.mBuffs[i4];
                    if (buffObject2.getPriority() < 2000 || buffObject2.getPriority() >= 3000) {
                        break;
                    }
                    z = true;
                    BuffScript.setGameObject(this);
                    buffObject2.eventRenderingEffect(directionalSpriteObject, i2 + iConvertMeasurmentToScreenX, i3 + iConvertMeasurmentToScreenY, this.mInfluenceValue);
                    i4++;
                }
            }
            directionalSpriteObject.draw(i2, i3, this.mInfluenceValue);
            if (z) {
                iRenderingPlatform.setBlur(blurWidth, blurHeight);
                iRenderingPlatform.setColorModification(colorModification);
                iRenderingPlatform.setScale(scaleWidth, scaleHeight);
            }
        }
    }

    public BuffObject findBuffObject(int i2) {
        for (int i3 = 0; i3 < this.mBuffsCount; i3++) {
            BuffObject buffObject = this.mBuffs[i3];
            if (buffObject.getBuffId() == i2) {
                return buffObject;
            }
        }
        return null;
    }

    public int findIndexOfBuff(int i2) {
        for (int i3 = 0; i3 < this.mBuffsCount; i3++) {
            if (this.mBuffs[i3].getBuffId() == i2) {
                return i3;
            }
        }
        return -1;
    }

    public void gestureOccurred(GestureEvent gestureEvent) {
        if (isDead()) {
        }
        switch (this.mType) {
            case 1:
                Camera2D camera = this.mEngine.getCamera();
                switch (gestureEvent.getType()) {
                    case 1000:
                        if (!camera.hasReachedDestination()) {
                            setPos(camera.getX(), camera.getY());
                        }
                        this.mPlayerStartPositionX = getX();
                        this.mPlaterStartPositionY = getY();
                        break;
                    case GestureEvent.TAPPED /* 1101 */:
                        changeState(1);
                        break;
                    case GestureEvent.DRAG_PRE /* 1200 */:
                    case GestureEvent.DRAGGING /* 1201 */:
                    case GestureEvent.DRAG_SWIPE /* 1203 */:
                    case GestureEvent.HOLDING /* 1301 */:
                        Duple pointAt = gestureEvent.getPointAt(gestureEvent.getPointCount() - 1);
                        float fConvertToGameX = camera.convertToGameX(pointAt.get0());
                        float fConvertToGameY = camera.convertToGameY(pointAt.get1());
                        Duple pointAt2 = gestureEvent.getPointAt(0);
                        setPos((camera.convertToGameX(pointAt2.get0()) - fConvertToGameX) + this.mPlayerStartPositionX, (camera.convertToGameY(pointAt2.get1()) - fConvertToGameY) + this.mPlaterStartPositionY);
                        gestureEvent.consume();
                        break;
                }
                break;
            case 16:
                switch (gestureEvent.getType()) {
                    case GestureEvent.TAPPED /* 1101 */:
                        if (this.mBuffs != null) {
                            for (int i2 = 0; i2 < this.mBuffsCount; i2++) {
                                if (this.mBuffs[i2] != null) {
                                    this.mBuffs[i2].gestureOccurred(gestureEvent, this);
                                    if (gestureEvent.isConsumed()) {
                                        break;
                                    }
                                }
                            }
                        }
                        break;
                }
                break;
        }
    }

    public int[][] getAnimationRids() {
        return this.mAnimationRids;
    }

    public int getAttackCooldownMax() {
        return this.mAttackCooldownMax;
    }

    public int getAttackDuration() {
        return this.mAttackRecoilTime;
    }

    public int getAttackPrepTime() {
        return this.mAttackPrepTime;
    }

    public BuffObject[] getBuffs() {
        return this.mBuffs;
    }

    public int getBuffsCount() {
        return this.mBuffsCount;
    }

    public int getCalculatedInfluenceValue() {
        return this.mCalculatedInfluenceValue;
    }

    public float getCollisionBottom() {
        if (this.mType == 128) {
            return this.mHeight + this.mPosY;
        }
        if (this.mType == 16) {
            return this.mEngine.getCamera().convertMeasurmentToGameY(this.mHeight * this.mEngine.getTileHeight()) + this.mPosY;
        }
        if (!isCollisionBoxesUsed()) {
            return this.mInfluenceRadius + this.mPosY;
        }
        if (this.mCurrentAnimation == null) {
            return this.mPosY;
        }
        CollisionBox[] collisionBoxes = this.mCurrentAnimation.getCurrentSpriteObject().getCollisionBoxes();
        if (collisionBoxes.length == 0) {
            return this.mPosY;
        }
        Camera2D camera = this.mEngine.getCamera();
        float f2 = -2.1474836E9f;
        for (CollisionBox collisionBox : collisionBoxes) {
            float fConvertMeasurmentToGameY = camera.convertMeasurmentToGameY(collisionBox.getHeight()) + this.mPosY + camera.convertMeasurmentToGameY(collisionBox.getY());
            if (fConvertMeasurmentToGameY > f2) {
                f2 = fConvertMeasurmentToGameY;
            }
        }
        return f2;
    }

    public float getCollisionLeft() {
        if (this.mType != 128 && this.mType != 16) {
            if (!isCollisionBoxesUsed()) {
                return this.mPosX - this.mInfluenceRadius;
            }
            if (this.mCurrentAnimation == null) {
                return this.mPosX;
            }
            CollisionBox[] collisionBoxes = this.mCurrentAnimation.getCurrentSpriteObject().getCollisionBoxes();
            if (collisionBoxes.length == 0) {
                return this.mPosX;
            }
            Camera2D camera = this.mEngine.getCamera();
            float f2 = 2.1474836E9f;
            for (CollisionBox collisionBox : collisionBoxes) {
                float fConvertMeasurmentToGameX = this.mPosX + camera.convertMeasurmentToGameX(collisionBox.getX());
                if (fConvertMeasurmentToGameX < f2) {
                    f2 = fConvertMeasurmentToGameX;
                }
            }
            return f2;
        }
        return this.mPosX;
    }

    public float getCollisionRight() {
        if (this.mType == 128) {
            return this.mInfluenceRadius + this.mPosX;
        }
        if (this.mType == 16) {
            return this.mEngine.getCamera().convertMeasurmentToGameX(this.mWidth * this.mEngine.getTileWidth()) + this.mPosX;
        }
        if (!isCollisionBoxesUsed()) {
            return this.mInfluenceRadius + this.mPosX;
        }
        if (this.mCurrentAnimation == null) {
            return this.mPosX;
        }
        CollisionBox[] collisionBoxes = this.mCurrentAnimation.getCurrentSpriteObject().getCollisionBoxes();
        if (collisionBoxes.length == 0) {
            return this.mPosX;
        }
        Camera2D camera = this.mEngine.getCamera();
        float f2 = -2.1474836E9f;
        for (CollisionBox collisionBox : collisionBoxes) {
            float fConvertMeasurmentToGameX = camera.convertMeasurmentToGameX(collisionBox.getWidth()) + this.mPosX + camera.convertMeasurmentToGameX(collisionBox.getX());
            if (fConvertMeasurmentToGameX > f2) {
                f2 = fConvertMeasurmentToGameX;
            }
        }
        return f2;
    }

    public float getCollisionTop() {
        if (this.mType != 128 && this.mType != 16) {
            if (!isCollisionBoxesUsed()) {
                return this.mPosY - this.mInfluenceRadius;
            }
            if (this.mCurrentAnimation == null) {
                return this.mPosY;
            }
            CollisionBox[] collisionBoxes = this.mCurrentAnimation.getCurrentSpriteObject().getCollisionBoxes();
            if (collisionBoxes.length == 0) {
                return this.mPosY;
            }
            Camera2D camera = this.mEngine.getCamera();
            float f2 = 2.1474836E9f;
            for (CollisionBox collisionBox : collisionBoxes) {
                float fConvertMeasurmentToGameY = this.mPosY + camera.convertMeasurmentToGameY(collisionBox.getY());
                if (fConvertMeasurmentToGameY < f2) {
                    f2 = fConvertMeasurmentToGameY;
                }
            }
            return f2;
        }
        return this.mPosY;
    }

    public int getColorFilter() {
        return this.mColorFilter;
    }

    public int getConstructionCostCoins() {
        return this.mConstructionCostCoins;
    }

    public int getConstructionCostFortunePoints() {
        return this.mConstructionCostFortunePoints;
    }

    public int getConstructionTime() {
        return this.mConstructionTime;
    }

    public int getConstructionTimeRemaining() {
        return this.mConstructionTimeRemaining;
    }

    public int getContractGroup() {
        return this.mContractGroup;
    }

    public int getContractID() {
        return this.mContractID;
    }

    public DirectionalSpriteObject getCurrentAnimation() {
        return this.mCurrentAnimation;
    }

    public int getCurrentSoundEffect() {
        return this.mCurrentSoundEffect;
    }

    public int getDescriptionTID() {
        return this.mDescriptionTID;
    }

    public int getEXP() {
        return this.mEXP;
    }

    public int getElapsedAnimationTime() {
        return this.mElapsedAnimationTime;
    }

    public int getElapsedTime() {
        return this.mElapsedTime;
    }

    public IRpgEngine getEngine() {
        return this.mEngine;
    }

    public int getEventId() {
        return this.mEventId;
    }

    public int getForSale() {
        return this.mForSale;
    }

    public int getHeight() {
        return this.mHeight;
    }

    public int getIncomeTime() {
        return this.mIncomeTime;
    }

    public int getIncomeValue() {
        return this.mSubType == 1 ? (this.mIncomeValue * (getCalculatedInfluenceValue() + 10000)) / 10000 : this.mIncomeValue;
    }

    public int getIncomeXP() {
        return this.mIncomeXP;
    }

    public int getInfluenceRadius() {
        return this.mInfluenceRadius;
    }

    public int getInfluenceValue() {
        return this.mInfluenceValue;
    }

    public int getInhabitants() {
        return this.mInhabitants;
    }

    public int getInstantBuildFactor() {
        return this.mInstantBuildFactor;
    }

    public int getLevelToUnlock() {
        return this.mLevelToUnlock;
    }

    public int getLifetime() {
        return this.mLifeTime;
    }

    public int getNameTID() {
        return this.mNameTID;
    }

    public int getObjectId() {
        return this.mObjectId;
    }

    public GameObject getOwner() {
        return this.mOwner;
    }

    public int getPreviousState() {
        return this.mPreviousState;
    }

    public int getShopAnimationRid() {
        return this.mShopAnimationRid;
    }

    public int getState() {
        return this.mState;
    }

    public int getSubType() {
        return this.mSubType;
    }

    public GameObject getTarget() {
        return this.mTarget;
    }

    public int getTargetLevelId() {
        return this.mTargetLevelId;
    }

    public int getTargetObjectId() {
        return this.mTargetObjectId;
    }

    public int getTeam() {
        return this.mTeam;
    }

    public int getTileX() {
        return this.mTileX;
    }

    public int getTileY() {
        return this.mTileY;
    }

    public int getTimer() {
        return this.mTimer;
    }

    public int getType() {
        return this.mType;
    }

    public int getUniqueSignature() {
        return this.mUniqueSignature;
    }

    public int getValue() {
        return this.mValue;
    }

    public int getWidth() {
        return this.mWidth;
    }

    public float getX() {
        return this.mPosX;
    }

    public float getY() {
        return this.mPosY;
    }

    public void increaseDamageMax(int i2) {
    }

    public void increaseDamageMin(int i2) {
    }

    public boolean isActive() {
        return this.mActive;
    }

    public boolean isCollidable() {
        return this.mCollidable;
    }

    public boolean isCollisionBoxesUsed() {
        return this.mDvcCollisionBoxes;
    }

    public boolean isDead() {
        return this.mState == 2 || this.mState == 0;
    }

    public boolean isDisabled() {
        return this.mState == 0;
    }

    public boolean isEnemyOf(GameObject gameObject) {
        return this.mTeam != gameObject.getTeam();
    }

    public boolean isEngageable() {
        return this.mEngageable;
    }

    public boolean isForSale() {
        return this.mForSale > 0;
    }

    public boolean isFrozen() {
        return this.mFrozen;
    }

    public boolean isIndestructible() {
        return this.mIndestructible;
    }

    public boolean isInsideGraphics(GestureEvent gestureEvent) {
        DirectionalSpriteObject currentAnimation = getCurrentAnimation();
        if (currentAnimation == null) {
            return false;
        }
        Camera2D camera = getEngine().getCamera();
        int x = gestureEvent.getX();
        int y = gestureEvent.getY();
        int iConvertToScreenX = camera.convertToScreenX(getX());
        int iConvertToScreenY = camera.convertToScreenY(getY());
        return x > currentAnimation.getEdgeLeft() + iConvertToScreenX && y > currentAnimation.getEdgeTop() + iConvertToScreenY && x <= iConvertToScreenX + currentAnimation.getEdgeRight() && y <= currentAnimation.getEdgeBottom() + iConvertToScreenY;
    }

    public boolean isLoadingComplete() {
        return this.mLoadingComplete;
    }

    public boolean isMovable() {
        return this.mMovable;
    }

    public boolean isOccupiesSpace() {
        return this.mOccupiesSpace;
    }

    public boolean isOnScreen() {
        return this.mIsOnScreen;
    }

    public boolean isPermanent() {
        return this.mPermanent;
    }

    public boolean isRoadConnected() {
        return (this.mRoadConnection != null && this.mRoadConnection.getWeight() > -1) || !needsRoadConnection();
    }

    public boolean isValidSavaLoadType() {
        return this.mType == 16 || this.mType == 1 || this.mType == 64 || this.mType == 128;
    }

    public void keyEventOccurred(int i2, int i3, int i4) {
        if (i3 != 0) {
            GameController.worldMove = false;
            this.worldMoveState = -1;
            return;
        }
        if (i4 == 11) {
            this.delayKeyMovements = 0;
            this.worldMoveState = 11;
            return;
        }
        if (i4 == 13) {
            this.delayKeyMovements = 0;
            this.worldMoveState = 13;
        } else if (i4 == 9) {
            this.delayKeyMovements = 0;
            this.worldMoveState = 9;
        } else if (i4 == 15) {
            this.delayKeyMovements = 0;
            this.worldMoveState = 15;
        }
    }

    public void leftPressed() {
    }

    public void leftReleased() {
    }

    public void loadAnimations() {
        if (this.mLoadingComplete) {
            return;
        }
        if (this.mAnimationRids != null) {
            for (int i2 = 0; i2 < 8; i2++) {
                if (i2 >= this.mAnimationRids.length || this.mAnimationRids[i2] == null || this.mAnimationRids[i2].length == 0) {
                    smWorkArray[i2] = smWorkArray[0];
                } else if (this.mAnimationRids[i2][0] != -1) {
                    smWorkArray[i2] = new DirectionalSpriteObject(this.mAnimationRids[i2]);
                } else if (i2 == 0) {
                    smWorkArray[0] = null;
                } else {
                    smWorkArray[i2] = smWorkArray[0];
                }
            }
            this.mAnimationIdle = smWorkArray[0];
            this.mAnimationDestroyed = smWorkArray[1];
            this.mAnimationDamaged = smWorkArray[2];
            this.mAnimationConstruction = smWorkArray[3];
            this.mAnimationRunning = smWorkArray[4];
            this.mAnimationAttackPrep = smWorkArray[5];
            this.mAnimationAttackRecoil = smWorkArray[6];
            this.mAnimationTalking = smWorkArray[7];
            this.mCurrentAnimation = getAnimationForState(this.mState);
        } else {
            unloadAnimations();
        }
        for (int i3 = 0; i3 < smWorkArray.length; i3++) {
            smWorkArray[i3] = null;
        }
        this.mLoadingComplete = true;
    }

    public void loadRecordStore(DChocByteArray dChocByteArray) {
        try {
            setActive(dChocByteArray.readBoolean());
            changeState(dChocByteArray.readInt());
            setPreviousState(dChocByteArray.readInt());
            setElapsedTime(dChocByteArray.readInt());
            setElapsedAnimationTime(dChocByteArray.readInt());
            setLifetime(dChocByteArray.readInt());
            setConstructionTimeRemaining(dChocByteArray.readInt());
            setPos(dChocByteArray.readInt() / 256.0f, dChocByteArray.readInt() / 256.0f);
            setContractID(dChocByteArray.readInt());
            if (getSubType() == 1 && !ApplicationStates.smIsGamePlayRestored) {
                setContractID(8);
            }
            setCalculatedInfluenceValue(dChocByteArray.readInt(), false);
            setForSale(dChocByteArray.readInt());
            if (dChocByteArray.readBoolean()) {
                removeAllBuffs();
                int i2 = dChocByteArray.readInt();
                if (getSubType() == 2 && !ApplicationStates.smIsGamePlayRestored && this.mState != 3) {
                    if (isForSale()) {
                        addBuffClone(Repository.findBuff(51));
                    } else {
                        addBuffClone(Repository.findBuff(40));
                    }
                }
                for (int i3 = 0; i3 < i2; i3++) {
                    int i4 = dChocByteArray.readInt();
                    if (getSubType() == 1 && i4 >= 58 && i4 <= 61 && !ApplicationStates.smIsGamePlayRestored) {
                        i4 = 60;
                    }
                    BuffObject buffObjectFindBuff = (i4 == 53 || i4 == 149 || (i4 == 150 && !ApplicationStates.smAreExpansionsCorrected)) ? null : Repository.findBuff(i4);
                    if (buffObjectFindBuff != null) {
                        addBuffClone(buffObjectFindBuff).loadRecordStore(dChocByteArray);
                    } else {
                        BuffObject buffObjectNew = BuffObject.New();
                        buffObjectNew.loadRecordStore(dChocByteArray);
                        BuffObject.Recycle(buffObjectNew);
                    }
                }
            }
            if (!isForSale()) {
                removeBuff(51);
            }
            if (getSubType() != 6 || ApplicationStates.smAreExpansionsCorrected || ToolCityExpansion.hasExpansionBeenBought(this.mEngine, getObjectId())) {
                return;
            }
            addBuffClone(Repository.findBuff(53), true);
            addBuffClone(Repository.findBuff(150), true);
            if (ToolCityExpansion.isExpansionLocked(this.mEngine, getObjectId())) {
                return;
            }
            removeBuff(149);
        } catch (IOException e2) {
            e2.printStackTrace();
        }
    }

    public void logicUpdate(int i2) {
        if (isActive()) {
            updateWorldKeyEvent();
            if (this.mState != 0) {
                if (!isRoadConnected() && this.mType == 16) {
                    addBuffClone(Repository.findBuff(46));
                } else if (isForSale()) {
                    addBuffClone(Repository.findBuff(51));
                }
                updateBuffs(i2);
                this.mAttackCooldownCurrent -= i2;
                if (isFrozen()) {
                    return;
                }
                this.mElapsedTime += i2;
                this.mCurrentAnimation = getAnimationForState(this.mState);
                DirectionalSpriteObject directionalSpriteObject = this.mCurrentAnimation;
                switch (this.mState) {
                    case 2:
                        if (directionalSpriteObject == null || this.mElapsedTime >= directionalSpriteObject.getAnimationLength()) {
                            if (this.mType != 1) {
                                LevelScript.event(this);
                                if (this.mType == 2 && (this.mPermanent || this.mConstructionTimeRemaining > 0)) {
                                    changeState(3);
                                } else {
                                    disable();
                                }
                            } else {
                                this.mEngine.generateGameObjectEvent(12, this);
                            }
                        }
                        break;
                    case 3:
                        if (isRoadConnected()) {
                            this.mConstructionTimeRemaining -= i2;
                        }
                        if (this.mConstructionTimeRemaining <= 0) {
                            changeState(4);
                        }
                        break;
                    case 4:
                        Effects.addEffect(0, this);
                        if (getSubType() == 1) {
                            addBuffClone(Repository.findBuff(58));
                        }
                        if (getSubType() == 4) {
                            HQScreen.addBonusToAllHousesFromNewWonder(getInfluenceValue());
                            HQScreen.updateBonusFromWonders();
                        } else if (getSubType() == 2) {
                            addBuffClone(Repository.findBuff(40));
                        }
                        changeState(1);
                        break;
                    case 7:
                        if (this.mElapsedTime >= 1000 || this.mTarget == null || updateAngle(i2, Utils.getAngleMathUtilsBase((int) (this.mTarget.getX() - this.mPosX), (int) (this.mTarget.getY() - this.mPosY))) < 1280) {
                            changeState(1);
                        }
                        break;
                    case 8:
                        if (this.mElapsedTime < 1000 && this.mTarget != null) {
                            int x = (int) (this.mTarget.getX() - this.mPosX);
                            int y = (int) (this.mTarget.getY() - this.mPosY);
                            if (Utils.distanceApprox(x, y) <= this.mInfluenceRadius + this.mTarget.getInfluenceRadius()) {
                                GameObject target = this.mTarget.getTarget();
                                if (target == null) {
                                    changeState(1);
                                } else {
                                    setTarget(target);
                                    changeState(8);
                                }
                            } else {
                                moveTowards(i2, x, y);
                            }
                        } else {
                            changeState(1);
                        }
                        break;
                    case 9:
                        if (this.mElapsedTime < this.mTimer && this.mTarget != null) {
                            moveTowards(i2, (int) (this.mPosX - this.mTarget.getX()), (int) (this.mPosY - this.mTarget.getY()));
                        } else {
                            changeState(1);
                        }
                        break;
                    case 100:
                        if (this.mTimer > 0 && this.mElapsedTime >= this.mTimer) {
                            int i3 = this.mElapsedTime - this.mTimer;
                            changeState(100);
                            this.mElapsedTime = i3;
                            LevelScript.event(this);
                        }
                        break;
                    case 200:
                        if (this.mType == 4) {
                            GameObject gameObject = this.mTarget;
                            if (gameObject == null || gameObject.isDead()) {
                                disable();
                            } else {
                                int x2 = (int) (gameObject.getX() - this.mPosX);
                                int y2 = (int) (gameObject.getY() - this.mPosY);
                                updateAngle(i2, Utils.getAngleMathUtilsBase(x2, y2));
                                if ((Utils.distanceApprox(x2, y2) - this.mInfluenceRadius) - gameObject.getInfluenceRadius() <= 0) {
                                    setPos(gameObject.getX(), gameObject.getY());
                                    behaviorDie();
                                }
                            }
                        } else {
                            GameObject gameObject2 = this.mTarget;
                            if (gameObject2 == null || gameObject2.isDead() || this.mElapsedTime >= 4000) {
                                changeState(1);
                            } else {
                                int x3 = (int) (gameObject2.getX() - this.mPosX);
                                int y3 = (int) (gameObject2.getY() - this.mPosY);
                                if (updateAngle(i2, Utils.getAngleMathUtilsBase(x3, y3)) < 7680) {
                                    int iDistanceApprox = (Utils.distanceApprox(x3, y3) - this.mInfluenceRadius) - gameObject2.getInfluenceRadius();
                                    if (gameObject2.isEnemyOf(this)) {
                                    }
                                    if (iDistanceApprox <= 0) {
                                        if (gameObject2.getType() != 2 && gameObject2.getType() != 1) {
                                            changeState(1);
                                            this.mEngine.generateGameObjectEvent(8, gameObject2);
                                        } else if (this.mAttackCooldownCurrent <= 0) {
                                            changeState(202);
                                        }
                                    }
                                }
                            }
                        }
                        break;
                    case 202:
                        GameObject gameObject3 = this.mTarget;
                        if (gameObject3 == null || gameObject3.getState() == 2 || gameObject3.getState() == 0) {
                            changeState(1);
                        } else if (this.mElapsedTime >= this.mAttackPrepTime) {
                            this.mAttackCooldownCurrent = this.mAttackCooldownMax;
                            changeState(203);
                            shootProjectileAt(gameObject3);
                        }
                        break;
                    case 203:
                        if (this.mElapsedTime >= this.mAttackRecoilTime) {
                            changeState(200);
                        }
                        break;
                    case 205:
                    case 206:
                        if (this.mTimer > 0 && this.mElapsedTime >= this.mTimer) {
                            changeState(1);
                        }
                        break;
                }
                if (this.mLifeTime > 0) {
                    this.mLifeTime -= i2;
                    if (this.mLifeTime <= 0) {
                        if (this.mType == 4 || this.mType == 64 || this.mType == 256) {
                            disable();
                        } else {
                            behaviorDie();
                        }
                    }
                }
            }
        }
    }

    public void move(int i2, int i3, int i4) {
        if (isFrozen()) {
            return;
        }
        if (i3 < 0) {
            int i5 = -i3;
        }
        if (i4 < 0) {
            int i6 = -i4;
        }
    }

    public boolean needsRoadConnection() {
        if (this.mType == 4) {
            return false;
        }
        switch (this.mSubType) {
            case 3:
            case 5:
            case 6:
                return false;
            case 4:
            default:
                return true;
        }
    }

    public void obstacleEncountered() {
    }

    public void prepareToDraw(IRenderingPlatform iRenderingPlatform, Camera2D camera2D) {
        DirectionalSpriteObject directionalSpriteObject;
        this.mIsOnScreen = false;
        if (this.mState == 0 || !isActive() || (directionalSpriteObject = this.mCurrentAnimation) == null) {
            return;
        }
        updateScreenPosition(camera2D);
        int i2 = this.mTempScreenX;
        int i3 = this.mTempScreenY;
        if (this.mSubType == 6) {
            int width = getWidth() * this.mEngine.getTileWidth();
            int height = getHeight() * this.mEngine.getTileHeight();
            if (width + i2 < camera2D.getViewportLeft() || i2 > camera2D.getViewportRight() || i3 + height < camera2D.getViewportTop() || i3 > camera2D.getViewportBottom()) {
                return;
            }
        } else if (directionalSpriteObject.getEdgeRight() + i2 < camera2D.getViewportLeft() || i2 + directionalSpriteObject.getEdgeLeft() > camera2D.getViewportRight() || directionalSpriteObject.getEdgeBottom() + i3 < camera2D.getViewportTop() || directionalSpriteObject.getEdgeTop() + i3 > camera2D.getViewportBottom()) {
            return;
        }
        this.mIsOnScreen = true;
    }

    public void removeAllBuffs() {
        if (this.mBuffs == null) {
            return;
        }
        for (int i2 = 0; i2 < this.mBuffsCount; i2++) {
            BuffObject buffObject = this.mBuffs[i2];
            if (buffObject.getBuffId() != this.mObjectId) {
                BuffScript.setGameObject(this);
                buffObject.eventRemovedFromObject();
                buffObject.disable();
            }
        }
    }

    public void removeBuff(int i2) {
        if (this.mBuffs == null) {
            return;
        }
        for (int i3 = 0; i3 < this.mBuffsCount; i3++) {
            BuffObject buffObject = this.mBuffs[i3];
            if (buffObject.getBuffId() == i2 && !buffObject.isDisabled()) {
                BuffScript.setGameObject(this);
                buffObject.eventRemovedFromObject();
                buffObject.disable();
                return;
            }
        }
    }

    public void reset(int i2) {
        this.mRunPhysicsAfter = false;
        this.mType = i2;
        this.mSubType = -1;
        this.mUniqueSignature = 0;
        this.mState = 0;
        changeState(1);
        this.mLifeTime = -1;
        this.mConstructionTimeRemaining = -1;
        this.mFrozen = false;
        this.mInfluenceRadius = 0;
        this.mHeight = 0;
        this.mWidth = 0;
        this.mConstructionCostFortunePoints = 0;
        this.mEXP = 0;
        this.mConstructionTime = 0;
        this.mConstructionCostCoins = 281600;
        this.mValue = 0;
        this.mColorFilter = -8355712;
        this.mPermanent = false;
        this.mActive = true;
        this.mMovable = true;
        this.mCollidable = true;
        this.mOccupiesSpace = true;
        this.mIndestructible = false;
        this.mEngageable = true;
        this.mDvcCollisionBoxes = false;
        this.mPosX = 0.0f;
        this.mPosY = 0.0f;
        this.mContractGroup = -1;
        this.mContractID = -1;
        this.mTileX = 0;
        this.mTileY = 0;
        this.mInfluenceValue = 0;
        this.mIncomeValue = 0;
        this.mCalculatedInfluenceValue = 0;
        this.mIncomeXP = 0;
        this.mIncomeTime = -1;
        this.mForSale = -1;
        this.mObjectId = -1;
        this.mTeam = 0;
        this.mEventId = -1;
        this.mTargetObjectId = -1;
        this.mTargetLevelId = -1;
        this.mTimer = 0;
        this.mCurrentSoundEffect = -1;
        this.mSoundEffectDeath = -1;
        this.mLevelToUnlock = 1;
        this.mInhabitants = 0;
        if (this.mBuffs != null) {
            for (int i3 = 0; i3 < this.mBuffsCount; i3++) {
                BuffObject.Recycle(this.mBuffs[i3]);
                this.mBuffs[i3] = null;
            }
            this.mBuffsCount = 0;
        } else if (i2 == 1 || i2 == 16 || i2 == 4) {
            this.mBuffs = new BuffObject[4];
            this.mBuffsCount = 0;
        }
        this.mAttackPrepTime = 0;
        this.mAttackRecoilTime = 0;
        this.mAttackCooldownCurrent = 0;
        this.mAttackCooldownMax = 0;
        this.mElapsedAnimationTime = 0;
        this.mIsOnScreen = false;
        this.mEngine = null;
        this.mOwner = null;
        setTarget(null);
        switch (i2) {
            case 4:
                this.mLifeTime = 20000;
                this.mCollidable = false;
                this.mOccupiesSpace = false;
                this.mIndestructible = true;
                this.mEngageable = false;
                break;
            case 8:
                this.mOccupiesSpace = false;
                break;
            case 16:
                this.mMovable = false;
                this.mEngageable = false;
                break;
            case 64:
            case 128:
                this.mMovable = false;
                this.mOccupiesSpace = false;
                this.mIndestructible = true;
                changeState(100);
                break;
            case 256:
                this.mMovable = false;
                this.mOccupiesSpace = false;
                this.mIndestructible = true;
                this.mCollidable = false;
                this.mActive = false;
                this.mEngageable = false;
                break;
        }
    }

    public void resetReferences() {
        this.mEngine = null;
        this.mTarget = null;
        this.mOwner = null;
    }

    public void resetTimer() {
        if (this.mType == 64) {
            this.mElapsedTime = 0;
        }
    }

    public void restartCurrentAnimation() {
        if (this.mCurrentAnimation != null) {
            this.mElapsedAnimationTime = 0;
        }
    }

    public void rightPressed() {
    }

    public void rightReleased() {
    }

    public void saveRecordStore(DChocByteArray dChocByteArray) {
        dChocByteArray.writeBoolean(this.mActive);
        dChocByteArray.writeInt(this.mState);
        dChocByteArray.writeInt(this.mPreviousState);
        dChocByteArray.writeInt(this.mElapsedTime);
        dChocByteArray.writeInt(this.mElapsedAnimationTime);
        dChocByteArray.writeInt(this.mLifeTime);
        dChocByteArray.writeInt(this.mConstructionTimeRemaining);
        dChocByteArray.writeInt((int) (this.mPosX * 256.0f));
        dChocByteArray.writeInt((int) (this.mPosY * 256.0f));
        dChocByteArray.writeInt(this.mContractID);
        dChocByteArray.writeInt(this.mCalculatedInfluenceValue);
        dChocByteArray.writeInt(this.mForSale);
        boolean z = this.mBuffs != null;
        dChocByteArray.writeBoolean(z);
        if (z) {
            dChocByteArray.writeInt(this.mBuffsCount);
            for (int i2 = 0; i2 < this.mBuffsCount; i2++) {
                dChocByteArray.writeInt(this.mBuffs[i2].getBuffId());
                this.mBuffs[i2].saveRecordStore(dChocByteArray);
            }
        }
    }

    public void setActive(boolean z) {
        if (this.mActive != z) {
            this.mActive = z;
            if (z) {
                this.mElapsedTime = 0;
            }
            getEngine().getObjectController().informActiveChange(this);
        }
    }

    public void setAnimationRids(int[][] iArr) {
        if (iArr != this.mAnimationRids) {
            unloadAnimations();
            this.mAnimationRids = iArr;
        }
    }

    public void setAttackCooldownMax(int i2) {
        this.mAttackCooldownMax = i2;
    }

    public void setAttackPrepTime(int i2) {
        this.mAttackPrepTime = i2;
    }

    public void setAttackRecoilTime(int i2) {
        this.mAttackRecoilTime = i2;
    }

    public void setCalculatedInfluenceValue(int i2, boolean z) {
        this.mCalculatedInfluenceValue = i2;
        if (z) {
            this.mEngine.generateGameObjectEvent(15, this);
        }
    }

    public void setCollidable(boolean z) {
        if (this.mCollidable != z) {
            this.mCollidable = z;
        }
    }

    public void setCollisionBoxesUsed(boolean z) {
        this.mDvcCollisionBoxes = z;
    }

    public void setColorFilter(int i2) {
        this.mColorFilter = i2;
    }

    public void setConstructionCostCoins(int i2) {
        this.mConstructionCostCoins = i2;
    }

    public void setConstructionCostFortunePoints(int i2) {
        this.mConstructionCostFortunePoints = i2;
    }

    public void setConstructionTime(int i2) {
        this.mConstructionTime = i2;
    }

    public void setConstructionTimeRemaining(int i2) {
        this.mConstructionTimeRemaining = i2;
    }

    public void setContractGroup(int i2) {
        this.mContractGroup = i2;
    }

    public void setContractID(int i2) {
        this.mContractID = i2;
    }

    public void setDescriptionTID(int i2) {
        this.mDescriptionTID = i2;
    }

    public void setDestination(int i2, int i3, boolean z) {
        int iDistanceApprox = Utils.distanceApprox((int) this.mPosX, (int) this.mPosY, i2, i3);
        if (iDistanceApprox > 1300) {
            GameObject gameObjectAddGameObject = this.mEngine.addGameObject(256, (int[][]) null);
            gameObjectAddGameObject.setInfluenceRadius(1);
            gameObjectAddGameObject.setPos(i2, i3);
            if (iDistanceApprox <= TOUCH_DISTANCE_ROTATION_ONLY) {
                setTarget(gameObjectAddGameObject);
                changeState(7);
            } else {
                setTarget(gameObjectAddGameObject);
                changeState(8);
            }
        }
    }

    public void setEXP(int i2) {
        this.mEXP = i2;
    }

    public void setElapsedAnimationTime(int i2) {
        this.mElapsedAnimationTime = i2;
        this.mAnimationDeltaTime = 0;
    }

    public void setElapsedTime(int i2) {
        this.mElapsedTime = i2;
    }

    public void setEngageable(boolean z) {
        this.mEngageable = z;
    }

    public void setEngine(IRpgEngine iRpgEngine) {
        this.mEngine = iRpgEngine;
    }

    public void setEventId(int i2) {
        this.mEventId = i2;
    }

    public void setForSale(int i2) {
        this.mForSale = i2;
    }

    public void setFrozen(boolean z) {
        this.mFrozen = z;
    }

    public void setHeight(int i2) {
        this.mHeight = i2;
    }

    public void setIncomeTime(int i2) {
        this.mIncomeTime = i2;
    }

    public void setIncomeValue(int i2) {
        this.mIncomeValue = i2;
    }

    public void setIncomeXP(int i2) {
        this.mIncomeXP = i2;
    }

    public void setIndestructible(boolean z) {
        this.mIndestructible = z;
    }

    public void setInfluenceRadius(int i2) {
        this.mInfluenceRadius = i2;
    }

    public void setInfluenceValue(int i2) {
        this.mInfluenceValue = i2;
    }

    public void setInhabitants(int i2) {
        this.mInhabitants = i2;
    }

    public void setInstantBuildFactor(int i2) {
        this.mInstantBuildFactor = i2;
    }

    public void setLevelToUnlock(int i2) {
        this.mLevelToUnlock = i2;
    }

    public void setLifetime(int i2) {
        this.mLifeTime = i2;
    }

    public void setMovable(boolean z) {
        if (this.mMovable != z) {
            this.mMovable = z;
        }
    }

    public void setNameTID(int i2) {
        this.mNameTID = i2;
    }

    public void setObjectId(int i2) {
        this.mObjectId = i2;
    }

    public void setOccupiesSpace(boolean z) {
        if (this.mOccupiesSpace != z) {
            this.mOccupiesSpace = z;
        }
    }

    public void setOwner(GameObject gameObject) {
        this.mOwner = gameObject;
    }

    public void setPermanent(boolean z) {
        this.mPermanent = z;
    }

    public void setPos(float f2, float f3) {
        setX(f2);
        setY(f3);
    }

    public void setPreviousState(int i2) {
        this.mPreviousState = i2;
    }

    public boolean setRoadConnection(TileData tileData) {
        if (!needsRoadConnection() || isRoadConnected()) {
            return true;
        }
        if (tileData.getWeight() > -1) {
            this.mRoadConnection = tileData;
            removeBuff(46);
            return true;
        }
        if (this.mRoadConnection != null) {
            this.mRoadConnection = null;
            addBuffClone(Repository.findBuff(46));
        }
        return false;
    }

    public void setShopAnimationRid(int i2) {
        this.mShopAnimationRid = i2;
    }

    public void setSoundDeath(int i2) {
        this.mSoundEffectDeath = i2;
    }

    public void setState(int i2) {
        this.mState = i2;
    }

    public void setSubType(int i2) {
        this.mSubType = i2;
    }

    public void setTarget(GameObject gameObject) {
        if (gameObject != null && gameObject.getType() == 256) {
            gameObject.setOwner(this);
        }
        if (this.mTarget != null && this.mTarget.getType() == 256) {
            this.mTarget.disable();
        }
        this.mTarget = gameObject;
    }

    public void setTargetLevelId(int i2) {
        this.mTargetLevelId = i2;
    }

    public void setTargetObjectId(int i2) {
        this.mTargetObjectId = i2;
    }

    public void setTeam(int i2) {
        this.mTeam = i2;
    }

    public void setTilePos(int i2, int i3) {
        setTileX(i2);
        setTileY(i3);
    }

    public void setTileX(int i2) {
        this.mTileX = i2;
    }

    public void setTileY(int i2) {
        this.mTileY = i2;
    }

    public void setTimer(int i2) {
        this.mTimer = i2;
    }

    public void setType(int i2) {
        this.mType = i2;
    }

    public void setUniqueSignature(int i2) {
        this.mUniqueSignature = i2;
    }

    public void setValue(int i2) {
        this.mValue = i2;
    }

    public void setWidth(int i2) {
        this.mWidth = i2;
    }

    public void setX(float f2) {
        this.mPosX = f2;
        setTileX((int) (f2 / 32));
    }

    public void setY(float f2) {
        this.mPosY = f2;
        setTileY((int) (f2 / 32));
    }

    public void unloadAnimations() {
        if (this.mAnimationIdle != null) {
            this.mAnimationIdle.freeResources();
            this.mAnimationIdle = null;
        }
        if (this.mAnimationDestroyed != null) {
            this.mAnimationDestroyed.freeResources();
            this.mAnimationDestroyed = null;
        }
        if (this.mAnimationRunning != null) {
            this.mAnimationRunning.freeResources();
            this.mAnimationRunning = null;
        }
        if (this.mAnimationAttackPrep != null) {
            this.mAnimationAttackPrep.freeResources();
            this.mAnimationAttackPrep = null;
        }
        if (this.mAnimationAttackRecoil != null) {
            this.mAnimationAttackRecoil.freeResources();
            this.mAnimationAttackRecoil = null;
        }
        if (this.mAnimationDamaged != null) {
            this.mAnimationDamaged.freeResources();
            this.mAnimationDamaged = null;
        }
        if (this.mAnimationConstruction != null) {
            this.mAnimationConstruction.freeResources();
            this.mAnimationConstruction = null;
        }
        if (this.mAnimationTalking != null) {
            this.mAnimationTalking.freeResources();
            this.mAnimationTalking = null;
        }
        this.mCurrentAnimation = null;
        this.mLoadingComplete = false;
    }

    public void upPressed() {
    }

    public void upReleased() {
    }

    public void updateAnimation(int i2) {
        if (!isActive() || isFrozen()) {
            return;
        }
        this.mAnimationDeltaTime += i2;
    }

    public void updatePhysicsAfterCollisions(int i2) {
    }

    public void updatePhysicsBeforeCollisions(int i2) {
    }

    public void updateScreenPosition(Camera2D camera2D) {
        this.mTempScreenX = camera2D.convertToScreenX(this.mPosX);
        this.mTempScreenY = camera2D.convertToScreenY(this.mPosY);
    }

    public void updateWorldKeyEvent() {
        if (GameController.worldMove) {
            if (this.delayKeyMovements != 0) {
                this.delayKeyMovements++;
                if (this.delayKeyMovements > 6) {
                    this.delayKeyMovements = 0;
                    return;
                }
                return;
            }
            switch (this.worldMoveState) {
                case 9:
                    setPos(getX(), getY() - 32.0f);
                    break;
                case 11:
                    setPos(getX() - 32.0f, getY());
                    break;
                case 13:
                    setPos(getX() + 32.0f, getY());
                    break;
                case 15:
                    setPos(getX(), getY() + 32.0f);
                    break;
            }
            this.delayKeyMovements++;
        }
    }
}