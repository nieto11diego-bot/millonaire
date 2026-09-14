package com.dchoc.dollars;

/* JADX INFO: loaded from: classes.dex */
public class ContractObject extends UiCollection {
    private static NumberFont smInfoNumberFont;
    private UiNumberField mCostField;
    private UiNumberField mIncomeField;
    private int mLineCount;
    private UiButton mSignButton;
    private UiNumberField mTenantsField;
    private UiNumberField mTimeField;

    public ContractObject(int i2, int i3, int i4, int i5, int i6, int i7, int i8, int i9) {
        if (smInfoNumberFont == null) {
            smInfoNumberFont = new NumberFont(ResourceIDs.ANM_INFO_FONT, true);
        }
        UiSprite uiSprite = new UiSprite(loadAnimation(i4));
        UiTextBox uiTextBox = new UiTextBox(loadText(i3));
        UiSprite uiSprite2 = new UiSprite(loadAnimation(ResourceIDs.ANM_ICON_HUD_CASH));
        this.mCostField = new UiNumberField(i8, 1);
        this.mCostField.setFont(UiScript.smPrice2NumberFont);
        this.mSignButton = UiScript.createButtonPositive(loadText(TextIDs.TID_CONTRACT_SIGN));
        setSize(uiSprite.getWidth(), uiSprite.getHeight());
        uiSprite.setAlignment(20);
        this.mSignButton.setWidth(100);
        uiSprite.setPos(0, 0);
        if (Toolkit.getScreenWidth() >= 480) {
            uiTextBox.setSize(uiSprite.getWidth() - 30, uiTextBox.getFont().getHeight() << 1);
            uiTextBox.setPos(15, 40);
            uiSprite2.setPos(15, 135);
            this.mCostField.setPos(47, 145);
        } else {
            uiTextBox.setSize(uiSprite.getWidth(), uiTextBox.getFont().getHeight() << 1);
            uiTextBox.setPos(0, 30);
            uiSprite2.setPos(20, 110);
            this.mCostField.setPos(40, 115);
        }
        this.mSignButton.setPos((uiSprite.getWidth() - this.mSignButton.getWidth()) >> 1, 188);
        uiTextBox.setAlignment(17);
        this.mCostField.setAlignment(17);
        this.mSignButton.setEvent(24);
        this.mSignButton.setParameter(i2);
        uiSprite2.enableAnimation(false);
        addComponent(uiSprite);
        addComponent(uiTextBox);
        addComponent(uiSprite2);
        addComponent(this.mCostField);
        addComponent(this.mSignButton);
        addIncome(i5);
        addXP(i6);
        addTenants(i7);
        addTime(i9);
    }

    private void addIncome(int i2) {
        this.mIncomeField = new UiNumberField(i2, 1);
        addLine(loadText(TextIDs.TID_INCOME), this.mIncomeField, ResourceIDs.ANM_ICON_INFO_INCOME);
    }

    private void addLine(String str, UiNumberField uiNumberField, int i2) {
        UiTextField uiTextField = new UiTextField(str);
        UiSprite uiSprite = new UiSprite(loadAnimation(i2));
        if (Toolkit.getScreenWidth() >= 480) {
            int y = getY() + (this.mLineCount * 19) + 65;
            uiSprite.setPos(25, y + 9);
            uiTextField.setPos(40, y);
            uiNumberField.setPos(150, y + 5);
        } else {
            int y2 = getY() + (this.mLineCount * 19) + 48;
            uiTextField.setPos(26, y2);
            uiNumberField.setPos(103, y2 + 5);
        }
        uiTextField.setFont(Fonts.getLight());
        uiTextField.setAlignment(20);
        uiNumberField.setFont(smInfoNumberFont);
        uiNumberField.setAlignment(24);
        uiSprite.setAlignment(3);
        addComponent(uiTextField);
        addComponent(uiNumberField);
        addComponent(uiSprite);
        this.mLineCount++;
    }

    private void addTenants(int i2) {
        this.mTenantsField = new UiNumberField(i2, 0);
        addLine(loadText(TextIDs.TID_TENANTS), this.mTenantsField, ResourceIDs.ANM_ICON_INFO_PEOPLES);
    }

    private void addTime(int i2) {
        UiSprite uiSprite = new UiSprite(loadAnimation(ResourceIDs.ANM_TIME_BIG_ICON));
        if (i2 > 1439) {
            int i3 = i2 / 1440;
            this.mTimeField = new UiNumberField(i3 == 1 ? new int[]{i3, NumberFont.SYMBOL_SPACE, NumberFont.SYMBOL_DAY} : new int[]{i3, NumberFont.SYMBOL_SPACE, NumberFont.SYMBOL_DAY, NumberFont.SYMBOL_S});
        } else if (i2 > 59) {
            int i4 = i2 / 60;
            this.mTimeField = new UiNumberField(i4 == 1 ? new int[]{i4, NumberFont.SYMBOL_SPACE, NumberFont.SYMBOL_HOUR} : new int[]{i4, NumberFont.SYMBOL_SPACE, NumberFont.SYMBOL_HOUR, NumberFont.SYMBOL_S});
        } else {
            this.mTimeField = new UiNumberField(i2 == 1 ? new int[]{i2, NumberFont.SYMBOL_SPACE, NumberFont.SYMBOL_MIN} : new int[]{i2, NumberFont.SYMBOL_SPACE, NumberFont.SYMBOL_MIN, NumberFont.SYMBOL_S});
        }
        this.mTimeField.setFont(UiScript.smPrice2NumberFont);
        uiSprite.setPos(105, 130);
        this.mTimeField.setPos(152, 140);
        uiSprite.setAlignment(17);
        this.mTimeField.setAlignment(24);
        uiSprite.enableAnimation(false);
        addComponent(uiSprite);
        addComponent(this.mTimeField);
    }

    private void addXP(int i2) {
        addLine(loadText(TextIDs.TID_XP), new UiNumberField(i2, 0), ResourceIDs.ANM_ICON_INFO_XP);
    }

    public void setCost(int i2) {
        this.mCostField.setValue(i2);
    }

    @Override // com.dchoc.dollars.UiComponent
    public void setEnabled(boolean z) {
        super.setEnabled(z);
        this.mSignButton.setVisible(z);
    }

    public void setIncome(int i2) {
        this.mIncomeField.setValue(i2);
    }

    public void setTenants(int i2) {
        this.mTenantsField.setValue(i2);
    }
}