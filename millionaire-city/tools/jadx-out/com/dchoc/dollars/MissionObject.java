package com.dchoc.dollars;

/* JADX INFO: loaded from: classes.dex */
public class MissionObject extends UiCollection {
    public static final int STATE_COMPLETED = 3;
    public static final int STATE_DISABLED = 4;
    public static final int STATE_LOCKED = 2;
    public static final int STATE_OPEN = 1;
    private UiButton button;
    private UiButton lockedButton;
    private UiCollection mCompletedUi;
    private int mDescriptionTid;
    private int mInfoEvent;
    private int mInfoParameter;
    private UiCollection mLockedUi;
    private String mNameText;
    private int mNameTid;
    private UiCollection mOpenUi;
    private UIProgressBar mProgressBar;
    private UiTextField mProgressField;
    private UiTextField mProgressText;
    private int mReward;
    private UiTextField mRewardCompleted;
    private UiTextField mRewardLocked;
    private UiTextField mRewardOpen;
    private int mSku;
    private int mState = 2;
    private boolean mTapped;
    private int mTargetAmount;
    private UiTextBox mTitleCompleted;
    private UiTextBox mTitleLocked;
    private UiTextBox mTitleOpen;
    private int mUnlockLevel;
    private int mUnlockSku;
    private String mUnlockingText;

    public MissionObject(int i2, int i3, int i4, int i5, int i6, int i7, int i8, int i9) {
        this.mSku = i2;
        this.mNameTid = i3;
        this.mDescriptionTid = i4;
        this.mUnlockLevel = i8;
        this.mUnlockSku = i9;
        this.mNameText = loadText(i3);
        createUnlockingText();
        this.mReward = i5;
        int i10 = Toolkit.getScreenWidth() >= 480 ? TextIDs.TID_BUY_THIS_SHOP : TextIDs.TID_HOUSE_14_NAME;
        this.mOpenUi = new UiCollection();
        UiButton uiButton = new UiButton();
        this.mTitleOpen = new UiTextBox(this.mNameText);
        UiSprite uiSprite = new UiSprite(loadAnimation(ResourceIDs.ANM_ICON_HUD_CASH));
        this.mRewardOpen = new UiTextField(UiScript.loadText(TextIDs.TID_MISSIONS_REWARD));
        UiNumberField uiNumberField = new UiNumberField(i5, 1);
        this.mProgressText = new UiTextField(UiScript.loadText(TextIDs.TID_MISSIONS_IN_PROGRESS));
        this.mProgressField = new UiTextField("0/" + i7);
        this.mTargetAmount = i7;
        this.mProgressBar = new UIProgressBar(0, i7, new UiThreeSlice(loadAnimation(ResourceIDs.ANM_TIME_BAR_BACKGROUND)), new UiThreeSlice(loadAnimation(ResourceIDs.ANM_TIME_BAR)));
        this.mProgressBar.setSize(120, 20);
        if (Toolkit.getScreenWidth() >= 480) {
            this.mProgressBar.setPos(15, 200);
        } else {
            this.mProgressBar.setPos(15, 125);
        }
        uiButton.setBackground(new UiNineSlice(loadAnimation(ResourceIDs.ANM_MISSION_PROGRESS_CARD)));
        uiButton.setSize(150, i10);
        this.mTitleOpen.setSize(uiButton.getWidth() - 30, this.mTitleOpen.getFont().getHeight() << 1);
        this.mOpenUi.setSize(150, i10);
        uiButton.setPos(0, 0);
        if (Toolkit.getScreenWidth() >= 480) {
            this.mTitleOpen.setPos(15, 35);
            uiSprite.setPos((uiButton.getWidth() - uiSprite.getWidth()) >> 1, 100);
            this.mRewardOpen.setPos(uiButton.getWidth() >> 1, 80);
            uiNumberField.setPos(uiButton.getWidth() >> 1, 110);
            this.mProgressText.setPos(uiButton.getWidth() >> 1, 165);
            this.mProgressField.setPos(uiButton.getWidth() >> 1, 201);
        } else {
            this.mTitleOpen.setPos(15, 10);
            uiSprite.setPos((uiButton.getWidth() - uiSprite.getWidth()) >> 1, 75);
            this.mRewardOpen.setPos(uiButton.getWidth() >> 1, 50);
            uiNumberField.setPos(uiButton.getWidth() >> 1, 75);
            this.mProgressText.setPos(uiButton.getWidth() >> 1, 110);
            this.mProgressField.setPos(uiButton.getWidth() >> 1, 124);
        }
        this.mTitleOpen.setAlignment(17);
        this.mRewardOpen.setAlignment(17);
        uiNumberField.setAlignment(17);
        this.mProgressText.setAlignment(17);
        this.mProgressField.setAlignment(17);
        uiButton.setEvent(20);
        uiButton.setParameter(i2);
        uiSprite.enableAnimation(false);
        this.mOpenUi.addComponent(uiButton);
        this.mOpenUi.addComponent(this.mTitleOpen);
        this.mOpenUi.addComponent(uiSprite);
        this.mOpenUi.addComponent(this.mRewardOpen);
        this.mOpenUi.addComponent(uiNumberField);
        if (i7 > 0) {
            this.mOpenUi.addComponent(this.mProgressText);
            this.mOpenUi.addComponent(this.mProgressBar);
            this.mOpenUi.addComponent(this.mProgressField);
        }
        addInfoButton(this.mOpenUi);
        this.mLockedUi = new UiCollection();
        this.mLockedUi.setBackground(new UiNineSlice(loadAnimation(ResourceIDs.ANM_MISSION_LOCKED_CARD)));
        this.mLockedUi.setSize(150, i10);
        this.mTitleLocked = new UiTextBox(this.mNameText);
        this.mRewardLocked = new UiTextField(UiScript.loadText(TextIDs.TID_MISSIONS_REWARD));
        UiNumberField uiNumberField2 = new UiNumberField(i5, 1);
        UiScript.replaceParameters(Toolkit.getText(158), "X");
        this.lockedButton = UiScript.createButtonNegative(UiScript.loadText(TextIDs.TID_LOCKED));
        this.mTitleLocked.setSize(120, this.mTitleLocked.getFont().getHeight() << 1);
        if (Toolkit.getScreenWidth() >= 480) {
            this.mTitleLocked.setPos(15, 25);
            this.mRewardLocked.setPos(75, 80);
            uiNumberField2.setPos(75, 110);
            this.lockedButton.setPos((150 - this.lockedButton.getWidth()) >> 1, 192);
        } else {
            this.mTitleLocked.setPos(15, 15);
            this.mRewardLocked.setPos(75, 65);
            uiNumberField2.setPos(75, 85);
            this.lockedButton.setPos((150 - this.lockedButton.getWidth()) >> 1, 117);
        }
        this.mTitleLocked.setAlignment(17);
        this.mRewardLocked.setAlignment(17);
        uiNumberField2.setAlignment(17);
        this.lockedButton.setEnabled(true);
        this.lockedButton.setEvent(27);
        this.lockedButton.setParameter(i2);
        this.mLockedUi.addComponent(this.mTitleLocked);
        this.mLockedUi.addComponent(this.mRewardLocked);
        this.mLockedUi.addComponent(uiNumberField2);
        this.mLockedUi.addComponent(this.lockedButton);
        this.mCompletedUi = new UiCollection();
        this.mCompletedUi.setBackground(new UiNineSlice(loadAnimation(ResourceIDs.ANM_MISSION_REWARD_CARD)));
        this.mCompletedUi.setSize(150, i10);
        this.mTitleCompleted = new UiTextBox(this.mNameText);
        UiSprite uiSprite2 = new UiSprite(loadAnimation(ResourceIDs.ANM_ICON_HUD_CASH));
        this.mRewardCompleted = new UiTextField(UiScript.loadText(TextIDs.TID_MISSIONS_REWARD));
        UiNumberField uiNumberField3 = new UiNumberField(i5, 1);
        this.button = UiScript.createButton(UiScript.loadText(TextIDs.TID_MISSIONS_GET_REWARD), ResourceIDs.ANM_BUTTON_ACCEPT);
        this.mTitleCompleted.setSize(120, this.mTitleCompleted.getFont().getHeight() << 1);
        this.button.setWidthToFitText();
        if (Toolkit.getScreenWidth() >= 480) {
            this.mTitleCompleted.setPos(15, 25);
            uiSprite2.setPos((150 - uiSprite2.getWidth()) >> 1, 100);
            this.mRewardCompleted.setPos(75, 80);
            uiNumberField3.setPos(75, 110);
        } else {
            this.mTitleCompleted.setPos(15, 15);
            uiSprite2.setPos((150 - uiSprite2.getWidth()) >> 1, 85);
            this.mRewardCompleted.setPos(75, 55);
            uiNumberField3.setPos(75, 85);
        }
        this.button.setPos((150 - this.button.getWidth()) >> 1, 192);
        this.mTitleCompleted.setAlignment(17);
        this.mRewardCompleted.setAlignment(17);
        uiNumberField3.setAlignment(17);
        uiSprite2.enableAnimation(false);
        this.button.setEvent(21);
        this.button.setParameter(i2);
        this.mCompletedUi.addComponent(this.mTitleCompleted);
        this.mCompletedUi.addComponent(uiSprite2);
        this.mCompletedUi.addComponent(this.mRewardCompleted);
        this.mCompletedUi.addComponent(uiNumberField3);
        this.mCompletedUi.addComponent(this.button);
        super.setSize(150, i10);
        super.addComponent(this.mOpenUi);
        super.addComponent(this.mLockedUi);
        super.addComponent(this.mCompletedUi);
    }

    private void createUnlockingText() {
        if (this.mUnlockLevel > 1) {
            if (this.mUnlockSku != -1) {
                this.mUnlockingText = UiScript.replaceParameters(UiScript.loadText(161), new String[]{UiScript.loadText(MissionScreen.getName(this.mUnlockSku)), ServletRequest.EMPTY_STRING + this.mUnlockLevel});
                return;
            } else {
                this.mUnlockingText = UiScript.replaceParameters(UiScript.loadText(160), this.mUnlockLevel);
                return;
            }
        }
        if (this.mUnlockSku != -1) {
            this.mUnlockingText = UiScript.replaceParameters(UiScript.loadText(159), UiScript.loadText(MissionScreen.getName(this.mUnlockSku)));
        } else {
            this.mUnlockingText = ServletRequest.EMPTY_STRING;
        }
    }

    public void addInfoButton(UiCollection uiCollection) {
        UiToggleIcon uiToggleIcon = new UiToggleIcon(UiScript.loadAnimation(ResourceIDs.ANM_ICON_INFO));
        uiToggleIcon.setPos((uiCollection.getWidth() - uiToggleIcon.getWidth()) - 5, 5);
        uiCollection.addComponent(uiToggleIcon);
    }

    public void changeState(int i2) {
        this.mState = i2;
    }

    @Override // com.dchoc.dollars.UiCollection, com.dchoc.dollars.UiComponent
    protected void draw(IRenderingPlatform iRenderingPlatform) {
        switch (this.mState) {
            case 1:
                this.mOpenUi.doDraw(iRenderingPlatform);
                break;
            case 2:
                this.mLockedUi.doDraw(iRenderingPlatform);
                break;
            case 3:
                this.mCompletedUi.doDraw(iRenderingPlatform);
                break;
        }
    }

    @Override // com.dchoc.dollars.UiCollection, com.dchoc.dollars.UiComponent
    public void gestureOccurred(GestureEvent gestureEvent) {
        boolean z = gestureEvent.getType() == 1300 || gestureEvent.getType() == 1302;
        switch (this.mState) {
            case 1:
                if (gestureEvent.getType() == 1101 || z) {
                    this.mTapped = true;
                    this.mOpenUi.gestureOccurred(gestureEvent);
                }
                break;
            case 2:
                this.mLockedUi.gestureOccurred(gestureEvent);
                break;
            case 3:
                this.mCompletedUi.gestureOccurred(gestureEvent);
                break;
        }
    }

    public String getDescriptionText() {
        return loadText(this.mDescriptionTid);
    }

    public String getNameText() {
        return this.mNameText;
    }

    public int getReward() {
        return this.mReward;
    }

    public int getSku() {
        return this.mSku;
    }

    public int getState() {
        return this.mState;
    }

    public String getUnlockingText() {
        return this.mUnlockingText;
    }

    public void languageChanged() {
        this.mNameText = loadText(this.mNameTid);
        this.mTitleOpen.setText(this.mNameText);
        this.mTitleLocked.setText(this.mNameText);
        this.mTitleCompleted.setText(this.mNameText);
        String strLoadText = UiScript.loadText(TextIDs.TID_MISSIONS_REWARD);
        this.mRewardOpen.setText(strLoadText);
        this.mRewardLocked.setText(strLoadText);
        this.mRewardCompleted.setText(strLoadText);
        this.lockedButton.setText(UiScript.loadText(TextIDs.TID_LOCKED));
        this.button.setText(UiScript.loadText(TextIDs.TID_MISSIONS_GET_REWARD));
        createUnlockingText();
        this.mProgressText.setText(UiScript.loadText(TextIDs.TID_MISSIONS_IN_PROGRESS));
    }

    @Override // com.dchoc.dollars.UiCollection, com.dchoc.dollars.UiComponent
    public UiEvent logicUpdate(int i2) {
        switch (this.mState) {
            case 1:
                if (!this.mTapped) {
                    return this.mOpenUi.logicUpdate(i2);
                }
                this.mTapped = false;
                return UiEvent.NEW(this.mInfoEvent, this.mInfoParameter);
            case 2:
                return this.mLockedUi.logicUpdate(i2);
            case 3:
                return this.mCompletedUi.logicUpdate(i2);
            default:
                return UiEvent.NO_EVENT;
        }
    }

    public void setInfoEvent(int i2, int i3) {
        this.mInfoEvent = i2;
        this.mInfoParameter = i3;
    }

    public void updateProgress(int i2) {
        if (this.mState != 1 || this.mTargetAmount <= 0) {
            return;
        }
        this.mProgressField.setText(i2 + "/" + this.mTargetAmount);
        this.mProgressBar.setCurrentValue(i2);
    }
}