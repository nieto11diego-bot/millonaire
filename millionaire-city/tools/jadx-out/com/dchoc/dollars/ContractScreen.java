package com.dchoc.dollars;

import javax.microedition.io.HttpConnection;

/* JADX INFO: loaded from: classes.dex */
public class ContractScreen extends UiCollection {
    private static final int DATA_BG_RID = 5;
    private static final int DATA_COST_COINS = 2;
    private static final int DATA_GROUP_COST_MODIFIER = 2;
    private static final int DATA_GROUP_INCOME_COINS = 3;
    private static final int DATA_GROUP_INHABITANTS = 0;
    private static final int DATA_GROUP_INVERSION = 1;
    private static final int DATA_ICON = 6;
    private static final int DATA_INCOME_COINS = 3;
    private static final int DATA_INCOME_TIME = 1;
    private static final int DATA_INCOME_XP = 0;
    private static final int DATA_NAME = 4;
    private static ContractObject[] smContractObjects;
    private UiTable mMissionsTable;
    private static final int[][] CONTRACT_IDS = {new int[]{1, 180, 36, 350, TextIDs.TID_CONTRACT_ID_1_NAME, ResourceIDs.ANM_CONTRACT_03, ResourceIDs.ANM_ICON_BUTTON_CONTRACT_01}, new int[]{3, 1800, 200, 1230, TextIDs.TID_CONTRACT_ID_2_NAME, ResourceIDs.ANM_CONTRACT_02, ResourceIDs.ANM_ICON_BUTTON_CONTRACT_02}, new int[]{7, 3600, 300, 1570, TextIDs.TID_CONTRACT_ID_3_NAME, ResourceIDs.ANM_CONTRACT_01, ResourceIDs.ANM_ICON_BUTTON_CONTRACT_03}, new int[]{15, 14400, 425, 4300, TextIDs.TID_CONTRACT_ID_4_NAME, ResourceIDs.ANM_CONTRACT_04, ResourceIDs.ANM_ICON_BUTTON_CONTRACT_04}, new int[]{20, 28800, HttpConnection.HTTP_INTERNAL_ERROR, 5800, TextIDs.TID_CONTRACT_ID_5_NAME, ResourceIDs.ANM_CONTRACT_05, ResourceIDs.ANM_ICON_BUTTON_CONTRACT_05}, new int[]{25, 43200, 1500, 8500, TextIDs.TID_CONTRACT_ID_6_NAME, ResourceIDs.ANM_CONTRACT_06, ResourceIDs.ANM_ICON_BUTTON_CONTRACT_06}, new int[]{30, GameStates.DAY, 2000, 12000, TextIDs.TID_CONTRACT_ID_7_NAME, ResourceIDs.ANM_CONTRACT_07, ResourceIDs.ANM_ICON_BUTTON_CONTRACT_07}, new int[]{40, 172800, 2500, 17000, TextIDs.TID_CONTRACT_ID_8_NAME, ResourceIDs.ANM_CONTRACT_08, ResourceIDs.ANM_ICON_BUTTON_CONTRACT_08}, new int[]{50, 259200, BuffObject.DRAWING_PRIORITY_IN_FRONT_OF_OBJECT, 20700, TextIDs.TID_CONTRACT_ID_9_NAME, ResourceIDs.ANM_CONTRACT_09, ResourceIDs.ANM_ICON_BUTTON_CONTRACT_09}};
    private static final int[][] CONTRACT_GROUPS = {new int[]{3, 30000, 250, 100}, new int[]{4, 60000, 250, 115}, new int[]{5, 100000, 270, TextIDs.TID_BUY_EXPANSION}, new int[]{6, 160000, 270, 300}, new int[]{5, 250000, 270, TextIDs.TID_RATE_TITLE}, new int[]{6, 300000, 270, 410}, new int[]{8, 200000, TextIDs.TID_FACEBOOK_APPLICATION_KEY, 270}, new int[]{9, 225000, TextIDs.TID_FACEBOOK_APPLICATION_KEY, 275}, new int[]{20, 600000, TextIDs.TID_HEADQUARTERS_FRIENDS_PLAYING, TextIDs.TID_SHARE}, new int[]{28, 1000000, TextIDs.TID_HEADQUARTERS_FRIENDS_PLAYING, 480}, new int[]{25, 3000000, TextIDs.TID_HEADQUARTERS_FRIENDS_PLAYING, 400}, new int[]{30, 7000000, TextIDs.TID_HEADQUARTERS_FRIENDS_PLAYING, HttpConnection.HTTP_INTERNAL_ERROR}, new int[]{6, 2000000, TextIDs.TID_HEADQUARTERS_FRIENDS_PLAYING, 600}, new int[]{7, 4000000, TextIDs.TID_HEADQUARTERS_FRIENDS_PLAYING, 680}, new int[]{35, 5000000, 300, 440}, new int[]{50, 15000000, 300, 900}, new int[]{5, 12000000, 300, 1450}};
    private static UiSprite smTutorialArrow = null;

    public ContractScreen(User user) {
        smContractObjects = new ContractObject[CONTRACT_IDS.length];
        UiScript.createFullScreenBoxWithTitleAndCloseButton(this, 332, false);
        addComponent(createMissionsScrollingContainer());
    }

    public static final int calculateCostContract(int i2, int i3) {
        return (CONTRACT_IDS[i2][2] * CONTRACT_GROUPS[i3][2]) / 100;
    }

    public static final int calculateCostContract(GameObject gameObject) {
        return calculateCostContract(gameObject.getContractID(), gameObject.getContractGroup());
    }

    public static final int calculateIncome(int i2, int i3, int i4) {
        int i5 = (((CONTRACT_IDS[i2][3] * CONTRACT_GROUPS[i3][3]) / 100) * (i4 + 10000)) / 10000;
        if (i5 >= 0) {
            return i5;
        }
        return (i5 * (-1)) + ((214748 + i5) * 2);
    }

    public static final int calculateIncome(GameObject gameObject) {
        return gameObject.getSubType() == 1 ? calculateIncome(gameObject.getContractID(), gameObject.getContractGroup(), gameObject.getCalculatedInfluenceValue()) : calculateIncome(gameObject.getContractID(), gameObject.getContractGroup(), 0);
    }

    public static final int calculateTenants(int i2) {
        return CONTRACT_GROUPS[i2][0];
    }

    public static final int calculateTenants(GameObject gameObject) {
        return calculateTenants(gameObject.getContractGroup());
    }

    public static final int calculateTimeMilliseconds(int i2) {
        return CONTRACT_IDS[i2][1] * 1000;
    }

    public static final int calculateTimeMilliseconds(GameObject gameObject) {
        return calculateTimeMilliseconds(gameObject.getContractID());
    }

    public static final int calculateTimeSeconds(int i2) {
        return CONTRACT_IDS[i2][1];
    }

    public static final int calculateTimeSeconds(GameObject gameObject) {
        return calculateTimeSeconds(gameObject.getContractID());
    }

    public static final int calculateXP(int i2) {
        return CONTRACT_IDS[i2][0];
    }

    public static final int calculateXP(GameObject gameObject) {
        return calculateXP(gameObject.getContractID());
    }

    private UiContainer createMissionsScrollingContainer() {
        UiScrollingContainer uiScrollingContainer = new UiScrollingContainer();
        this.mMissionsTable = new UiTable();
        uiScrollingContainer.setPadding(10, 10, 10, 10);
        if (Toolkit.getScreenWidth() >= 480) {
            uiScrollingContainer.setDimensions(5, 50, Toolkit.getScreenWidth() - 10, 265);
            this.mMissionsTable.setPos(uiScrollingContainer.getX() + uiScrollingContainer.getPaddingLeft(), uiScrollingContainer.getY() + uiScrollingContainer.getPaddingTop());
        } else {
            uiScrollingContainer.setDimensions(0, 0, 300, Toolkit.getScreenHeight());
            this.mMissionsTable.setPos((uiScrollingContainer.getWidth() / 2) - 62, (uiScrollingContainer.getHeight() / 2) - 75);
        }
        this.mMissionsTable.getCellAt(0, 0).setWidth(25);
        for (int i2 = 0; i2 < CONTRACT_IDS.length; i2++) {
            int i3 = (i2 << 1) + 1;
            smContractObjects[i2] = new ContractObject(i2, CONTRACT_IDS[i2][4], CONTRACT_IDS[i2][5], 0, calculateXP(i2), calculateTenants(0), calculateCostContract(i2, 0), calculateTimeSeconds(i2) / 60);
            this.mMissionsTable.setContentAt(smContractObjects[i2], i3, 0);
            int i4 = i3 + 1;
            this.mMissionsTable.getCellAt(i4, 0);
            if (i2 < CONTRACT_IDS.length - 1) {
                this.mMissionsTable.setColumnWidth(i4, 25);
            } else {
                this.mMissionsTable.setColumnWidth(i4, 25);
            }
        }
        uiScrollingContainer.setContent(this.mMissionsTable, false, false);
        uiScrollingContainer.setScrollingLocks(false, true);
        return uiScrollingContainer;
    }

    public static final int getIconRid(int i2) {
        return CONTRACT_IDS[i2][6];
    }

    public static final int getIconRid(GameObject gameObject) {
        return getIconRid(gameObject.getContractID());
    }

    public static final String getName(int i2) {
        return TextStore.getInstance().get(CONTRACT_IDS[i2][4]);
    }

    public static final String getName(GameObject gameObject) {
        return getName(gameObject.getContractID());
    }

    public void activate(GameObject gameObject) {
        int contractGroup = gameObject.getContractGroup();
        for (int i2 = 0; i2 < CONTRACT_IDS.length; i2++) {
            smContractObjects[i2].setIncome(calculateIncome(i2, contractGroup, gameObject.getCalculatedInfluenceValue()));
            smContractObjects[i2].setTenants(calculateTenants(contractGroup));
            smContractObjects[i2].setCost(calculateCostContract(i2, contractGroup));
        }
    }

    public void enableAllContracts(boolean z) {
        int length = CONTRACT_IDS.length;
        for (int i2 = 0; i2 < length; i2++) {
            smContractObjects[i2].setEnabled(z);
        }
    }

    public void enableContract(int i2, boolean z) {
        smContractObjects[i2].setEnabled(z);
    }

    public void hideTutorialArrow(int i2) {
        int componentIndex;
        if (smTutorialArrow == null || (componentIndex = smContractObjects[i2].getComponentIndex(smTutorialArrow)) <= -1) {
            return;
        }
        smContractObjects[i2].removeComponent(componentIndex);
    }

    public void showTutorialArrow(int i2) {
        if (smTutorialArrow == null) {
            smTutorialArrow = new UiSprite(UiScript.loadAnimation(ResourceIDs.ANM_ARROW_04));
            smTutorialArrow.setPos(55, 140);
        }
        if (Toolkit.getScreenWidth() >= 480) {
            smContractObjects[i2].addComponent(smTutorialArrow);
        }
    }
}