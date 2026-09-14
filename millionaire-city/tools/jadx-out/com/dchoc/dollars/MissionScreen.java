package com.dchoc.dollars;

import java.io.EOFException;

/* JADX INFO: loaded from: classes.dex */
public class MissionScreen extends UiCollection {
    public static final int BONUS_BUNGALOW = 23;
    public static final int BONUS_BUNGALOW_LUXARY = 24;
    public static final int BONUS_CHATEAUS = 27;
    public static final int BONUS_TOWNHOUSE = 25;
    public static final int BONUS_VILLA = 26;
    public static final int BUY_ALL_WONDERS = 36;
    public static final int BUY_BIG_GARDEN = 12;
    public static final int BUY_CHATEAUS = 15;
    public static final int BUY_COFFEE_SHOP = 8;
    public static final int BUY_COMMERCES = 9;
    public static final int BUY_DUPLEX_LUXURY = 14;
    public static final int BUY_EXPANSION = 34;
    public static final int BUY_FOUNTAINS = 11;
    public static final int BUY_PIZZERIA = 2;
    public static final int BUY_SKYSCRAPERS = 16;
    public static final int BUY_TOWNHOUSE = 7;
    public static final int BUY_TOWNHOUSE_LUXURY = 13;
    public static final int BUY_TREES = 10;
    public static final int BUY_WONDER = 17;
    public static final int CLIENTS_COFFEE_SHOP = 21;
    public static final int CLIENTS_NIGHT_CLUB = 22;
    public static final int CLIENTS_PIZZERIA_1 = 18;
    public static final int CLIENTS_PIZZERIA_2 = 19;
    public static final int CLIENTS_PIZZERIA_3 = 20;
    public static final int COLLECT_COFFEE_SHOP = 29;
    public static final int COLLECT_FROM_PIZZERIA = 28;
    public static final int COLLECT_RENTS_1 = 30;
    public static final int COLLECT_RENTS_2 = 31;
    public static final int COLLECT_RENTS_3 = 32;
    public static final int COLLECT_RENTS_4 = 33;
    private static final int COMMERCE_MISSION_BUY_TARGET = 5;
    public static final int COMPANY_VALUE_1 = 38;
    public static final int COMPANY_VALUE_2 = 39;
    public static final int COMPANY_VALUE_3 = 40;
    private static final int DATA_AMOUNT = 3;
    private static final int DATA_CONDITION = 4;
    private static final int DATA_DESCRIPTION = 7;
    private static final int DATA_NAME = 6;
    private static final int DATA_REWARD = 5;
    private static final int DATA_SKU = 0;
    private static final int DATA_UNLOCK_LEVEL = 2;
    private static final int DATA_UNLOCK_SKU = 1;
    private static final boolean DEBUG_SAVING_LOADING = false;
    public static final int FACEBOOK_CONNECT = 1;
    public static final int FACEBOOK_FRIENDS_1 = 42;
    public static final int FACEBOOK_FRIENDS_2 = 43;
    public static final int FACEBOOK_FRIENDS_3 = 44;
    public static final int FACEBOOK_HAVE_MANAGER = 3;
    public static final int FACEBOOK_HAVE_MANAGERS = 4;
    public static final int FACEBOOK_POST = 41;
    public static final int MILLIONAIRE_1 = 37;
    public static final int MILLIONAIRE_2 = 35;
    public static final int NONE = -1;
    public static final int SIGN_CONTRACTS_1 = 5;
    public static final int SIGN_CONTRACTS_2 = 6;
    public static final int WONDERS_MISSION_BUY_TARGET = 3;
    private static int[] smAmountCounted;
    private static boolean[] smCollected;
    private static int[] smCommerceMissionUniqueBoughtBuildings;
    private static boolean[] smCompleted;
    private static MissionObject[] smCompletedMissionObjects;
    private static int[] smIndexes;
    private static MissionObject[] smLockedMissionObjects;
    private static MissionObject[] smMissionObjects;
    public static boolean[] smMissionPopUpVisited;
    private static MissionObject[] smOpenMissionObjects;
    private static User smUser;
    private static int[] smWondersMissionUniqueBought;
    public static int softkey_sku;
    private UiContainer mContents;
    private UiComponent mInfoPopup;
    private UiComponent mLockedPopup;
    private UiTable mMissionsTable;
    private UiComponent mRewardPopup;
    private int mRewardSku;
    public final int[] smPopupVisited = {2, 28, 18, 19, 20, 23, 24, 7, 25, 8, 21, 29, 10, 11, 12, 13, 16, 17, 26, 6, 30, 31, 32, 33, 34, 37, 35, 38, 39, 40, 36, INSTANT_BUILD};
    private static boolean hackMission = false;
    private static final int[] hackMissions = {8, 21, 29};
    private static boolean smIsInitialized = false;
    public static final int INSTANT_BUILD = 420;
    public static final int[][] DATA = {new int[]{2, -1, 1, 1, 0, 35000, 70, 71}, new int[]{28, 2, 1, 1, 0, 25000, 122, 123}, new int[]{18, 2, 1, 1, 3, 30000, 102, 103}, new int[]{19, 18, 1, 1, 10, 35000, 104, 105}, new int[]{20, 19, 1, 1, 16, 60000, 106, 107}, new int[]{23, -1, 1, 1, 12, 25000, 112, 113}, new int[]{24, 23, 1, 1, 16, 60000, 114, 115}, new int[]{7, -1, 5, 1, 0, 35000, 80, 81}, new int[]{25, 7, 1, 1, 30, 40000, 116, 117}, new int[]{8, -1, 5, 1, 0, 35000, 82, 83}, new int[]{21, 8, 1, 1, 12, 35000, 108, 109}, new int[]{29, 8, 1, 50, 0, 55000, 124, 125}, new int[]{10, -1, 1, 2, 0, 35000, 86, 87}, new int[]{11, -1, 13, 3, 0, 40000, 88, 89}, new int[]{12, -1, 24, 1, 0, 40000, 90, 91}, new int[]{13, -1, 6, 1, 0, 40000, 92, 93}, new int[]{16, -1, 23, 3, 0, 250000, 98, 99}, new int[]{17, -1, 1, 1, 0, 35000, 100, 101}, new int[]{26, -1, 18, 1, 90, 50000, 118, 119}, new int[]{5, -1, 1, 2, 0, 40000, 76, 77}, new int[]{6, 5, 1, 20, 0, 50000, 78, 79}, new int[]{30, -1, 4, 10, 0, 30000, 126, 127}, new int[]{31, 30, 4, 50, 0, 35000, 128, 129}, new int[]{32, 31, 4, 100, 0, 40000, 130, 131}, new int[]{33, 32, 4, 200, 0, 45000, 132, 133}, new int[]{34, -1, 20, 1, 0, 55000, 134, 135}, new int[]{37, -1, 10, 1, 1000000, 35000, 140, 141}, new int[]{35, -1, 10, 1, 10000000, 125000, 136, 137}, new int[]{38, -1, 1, 1, 1000000, 35000, 142, 143}, new int[]{39, 38, 1, 1, 5000000, 55000, 144, 145}, new int[]{40, 39, 1, 1, 10000000, 125000, 146, 147}, new int[]{36, -1, 1, 1, 6, 200000, 138, 139}, new int[]{INSTANT_BUILD, -1, 1, 10, 0, 50000, 156, 157}};
    public static int collectedMissionCount = 0;
    private static boolean mScreenNeedsRefresh = false;

    public MissionScreen(User user) {
        if (smCommerceMissionUniqueBoughtBuildings == null) {
            smCommerceMissionUniqueBoughtBuildings = new int[5];
            for (int i2 = 0; i2 < 5; i2++) {
                smCommerceMissionUniqueBoughtBuildings[i2] = -1;
            }
        }
        if (smWondersMissionUniqueBought == null) {
            smWondersMissionUniqueBought = new int[3];
            for (int i3 = 0; i3 < 3; i3++) {
                smWondersMissionUniqueBought[i3] = -1;
            }
        }
        smUser = user;
        smIndexes = new int[DATA.length + 1];
        smMissionObjects = new MissionObject[DATA.length];
        smCompletedMissionObjects = new MissionObject[DATA.length];
        smOpenMissionObjects = new MissionObject[DATA.length];
        smLockedMissionObjects = new MissionObject[DATA.length];
        if (smAmountCounted == null) {
            smAmountCounted = new int[DATA.length];
        }
        if (smMissionPopUpVisited == null) {
            smMissionPopUpVisited = new boolean[DATA.length];
        }
        if (smCompleted == null) {
            smCompleted = new boolean[DATA.length];
        }
        if (smCollected == null) {
            smCollected = new boolean[DATA.length];
        }
        UiScript.createFullScreenBoxWithTitleAndCloseButton(this, 250, false);
        this.mContents = createMissionsScrollingContainer();
        UiScript.createButtonNegativeIcon().setEvent(7);
        UiNineSlice uiNineSlice = new UiNineSlice(loadAnimation(ResourceIDs.ANM_FADE_VERTICAL_LEFT));
        UiNineSlice uiNineSlice2 = new UiNineSlice(loadAnimation(ResourceIDs.ANM_FADE_VERTICAL_RIGHT));
        uiNineSlice.setDimensions(13, 58, 48, TextIDs.TID_LOSING_RENT);
        uiNineSlice2.setDimensions(Toolkit.getScreenWidth() - 61, 58, 48, TextIDs.TID_LOSING_RENT);
        addComponent(this.mContents);
        addComponent(uiNineSlice);
        addComponent(uiNineSlice2);
        if (getWidth() > 0) {
            setPos((Toolkit.getScreenWidth() - getWidth()) / 2, (Toolkit.getScreenHeight() - getHeight()) / 2);
        }
        int i4 = 0;
        while (true) {
            int i5 = i4;
            if (i5 >= DATA.length) {
                break;
            }
            int i6 = DATA[i5][0];
            int length = smIndexes.length;
            if (i6 >= length) {
                int[] iArr = new int[i6 + 1];
                System.arraycopy(smIndexes, 0, iArr, 0, length);
                smIndexes = iArr;
            }
            smIndexes[i6] = i5;
            smMissionObjects[i5] = new MissionObject(DATA[i5][0], DATA[i5][6], DATA[i5][7], DATA[i5][5], 0, DATA[i5][3], DATA[i5][2], DATA[i5][1]);
            smMissionObjects[i5].setInfoEvent(20, DATA[i5][0]);
            if (DATA[i5][1] == -1 && DATA[i5][2] <= smUser.getLevel()) {
                smMissionObjects[i5].changeState(1);
            }
            i4 = i5 + 1;
        }
        for (int i7 = 0; i7 < DATA.length; i7++) {
            MissionObject missionObject = smMissionObjects[i7];
            int sku = missionObject.getSku();
            if (isCompleted(sku)) {
                missionCompleted(sku);
            }
            if (isCollected(sku)) {
                removeMission(missionObject);
            }
        }
        int i8 = 0;
        int i9 = 0;
        int i10 = 0;
        for (int i11 = 0; i11 < DATA.length; i11++) {
            if (smMissionObjects[i11].getState() == 3) {
                smMissionPopUpVisited[i11] = true;
                if (!isCollected(smMissionObjects[i11].getSku())) {
                    smCompletedMissionObjects[i8] = smMissionObjects[i11];
                    i8++;
                }
            } else if (smMissionObjects[i11].getState() == 1) {
                smMissionPopUpVisited[i11] = false;
                smOpenMissionObjects[i9] = smMissionObjects[i11];
                if (smAmountCounted != null) {
                    smOpenMissionObjects[i9].updateProgress(smAmountCounted[i11]);
                }
                i9++;
            } else if (smMissionObjects[i11].getState() == 2) {
                smMissionPopUpVisited[i11] = false;
                smLockedMissionObjects[i10] = smMissionObjects[i11];
                i10++;
            } else {
                smMissionPopUpVisited[i11] = false;
            }
        }
        AddMissionsFromArray(smCompletedMissionObjects);
        AddMissionsFromArray(smOpenMissionObjects);
        AddMissionsFromArray(smLockedMissionObjects);
        smIsInitialized = true;
    }

    private void AddMissionsFromArray(MissionObject[] missionObjectArr) {
        int length = missionObjectArr.length;
        for (int i2 = 0; i2 < length && missionObjectArr[i2] != null; i2++) {
            addMission(missionObjectArr[i2]);
        }
    }

    public static void buildingBought(GameObject gameObject) {
        switch (gameObject.getObjectId()) {
            case 2:
                improve(7);
                break;
            case 3:
                improve(13);
                break;
            case 5:
                improve(14);
                break;
            case 13:
                improve(16);
                break;
            case 15:
                improve(15);
                break;
            case 17:
                improve(2);
                improveUniqueBuildingsMission(17);
                break;
            case 18:
                improve(8);
                improveUniqueBuildingsMission(18);
                break;
            case 19:
                improveUniqueBuildingsMission(19);
                break;
            case 20:
                improveUniqueBuildingsMission(20);
                break;
            case 21:
                improveUniqueBuildingsMission(21);
                break;
            case 22:
                improveUniqueBuildingsMission(22);
                break;
            case 23:
                improveUniqueBuildingsMission(23);
                break;
            case 24:
                improveUniqueBuildingsMission(24);
                break;
            case 25:
                improveUniqueBuildingsMission(25);
                break;
            case 26:
                improveUniqueBuildingsMission(26);
                break;
            case 27:
            case 28:
            case 29:
            case 31:
            case 32:
                improve(10);
                break;
            case 30:
                improve(11);
                break;
            case 33:
                improve(12);
                break;
            case 34:
                improve(17);
                improveUniqueWondersMission(34);
                break;
            case 35:
                improve(17);
                improveUniqueWondersMission(35);
                break;
            case 36:
                improve(17);
                improveUniqueWondersMission(36);
                break;
            case 152:
                improve(17);
                improveUniqueWondersMission(152);
                break;
            case 160:
                improve(17);
                improveUniqueWondersMission(160);
                break;
        }
    }

    public static void checkForCompanyValueMissions(int i2) {
        if (i2 >= getCondition(38)) {
            improve(38);
        }
        if (i2 >= getCondition(39)) {
            improve(39);
        }
        if (i2 >= getCondition(40)) {
            improve(40);
        }
    }

    public static void checkIfAllMissionCompletedHaveBeenCollected() {
        if (isNewMissionCompleted()) {
            return;
        }
        UiScript.showMissionCompleted(false);
    }

    private UiComponent createInfoPopup(MissionObject missionObject) {
        UiCollection uiCollection = new UiCollection();
        uiCollection.setBackground(new UiNineSlice(loadAnimation(ResourceIDs.ANM_SLICE_BOX)));
        uiCollection.setDimensions(getX() + 70, getY() + 70, TextIDs.TID_CONTRACT_ID_6_NAME, TextIDs.TID_TUTORIAL_MESSAGE_2);
        UiTextField uiTextField = new UiTextField(missionObject.getNameText());
        UiScrollingTextBox uiScrollingTextBox = new UiScrollingTextBox();
        UiButton uiButtonCreateButtonPositive = UiScript.createButtonPositive(TextStore.getInstance().get(2));
        uiButtonCreateButtonPositive.enlargeHitArea(50, 50);
        uiScrollingTextBox.setDimensions(20, 50, uiCollection.getWidth() - 40, 110);
        uiScrollingTextBox.setText(missionObject.getDescriptionText());
        uiScrollingTextBox.setAlignment(17);
        uiTextField.setPos(uiCollection.getWidth() >> 1, 10);
        uiButtonCreateButtonPositive.setPos((uiCollection.getWidth() - uiButtonCreateButtonPositive.getWidth()) >> 1, (-10) + (uiCollection.getHeight() - uiButtonCreateButtonPositive.getHeight()));
        uiTextField.setAlignment(17);
        uiButtonCreateButtonPositive.setEvent(3);
        uiCollection.addComponent(uiTextField);
        uiCollection.addComponent(uiScrollingTextBox);
        uiCollection.addComponent(uiButtonCreateButtonPositive);
        return uiCollection;
    }

    private UiComponent createLockedPopup(MissionObject missionObject) {
        UiCollection uiCollection = new UiCollection();
        uiCollection.setBackground(new UiNineSlice(loadAnimation(ResourceIDs.ANM_SLICE_BOX)));
        uiCollection.setDimensions(getX() + 70, getY() + 70, TextIDs.TID_CONTRACT_ID_6_NAME, TextIDs.TID_TUTORIAL_MESSAGE_2);
        UiTextField uiTextField = new UiTextField(missionObject.getNameText());
        UiScrollingTextBox uiScrollingTextBox = new UiScrollingTextBox();
        UiButton uiButtonCreateButtonPositive = UiScript.createButtonPositive(TextStore.getInstance().get(2));
        uiButtonCreateButtonPositive.enlargeHitArea(50, 50);
        uiScrollingTextBox.setDimensions(20, 50, uiCollection.getWidth() - 40, 110);
        uiScrollingTextBox.setText(missionObject.getUnlockingText());
        uiTextField.setPos(uiCollection.getWidth() >> 1, 10);
        uiButtonCreateButtonPositive.setPos((uiCollection.getWidth() - uiButtonCreateButtonPositive.getWidth()) >> 1, (-10) + (uiCollection.getHeight() - uiButtonCreateButtonPositive.getHeight()));
        uiTextField.setAlignment(17);
        uiButtonCreateButtonPositive.setEvent(3);
        uiCollection.addComponent(uiTextField);
        uiCollection.addComponent(uiScrollingTextBox);
        uiCollection.addComponent(uiButtonCreateButtonPositive);
        return uiCollection;
    }

    private UiContainer createMissionsScrollingContainer() {
        MissionScrollingContainer missionScrollingContainer = new MissionScrollingContainer();
        this.mMissionsTable = new UiTable();
        if (Toolkit.getScreenWidth() >= 480) {
            missionScrollingContainer.setPadding(10, 10, 10, 10);
            missionScrollingContainer.setDimensions(5, 50, Toolkit.getScreenWidth() - 10, 265);
            this.mMissionsTable.setPos(missionScrollingContainer.getX() + missionScrollingContainer.getPaddingLeft(), missionScrollingContainer.getY() + missionScrollingContainer.getPaddingTop());
            this.mMissionsTable.getCellAt(0, 0).setWidth(25);
        } else {
            missionScrollingContainer.setPadding(10, 10, 10, 10);
            missionScrollingContainer.setDimensions(0, 25, 250, 178);
            this.mMissionsTable.setPos((missionScrollingContainer.getX() + missionScrollingContainer.getPaddingLeft()) - 5, missionScrollingContainer.getY() + missionScrollingContainer.getPaddingTop());
            this.mMissionsTable.getCellAt(0, 0).setWidth(70);
        }
        missionScrollingContainer.setContent(this.mMissionsTable, false, false);
        missionScrollingContainer.setScrollingLocks(false, true);
        return missionScrollingContainer;
    }

    private UiComponent createRewardPopup(MissionObject missionObject) {
        UiCollection uiCollection = new UiCollection();
        uiCollection.setBackground(new UiNineSlice(loadAnimation(ResourceIDs.ANM_SLICE_BOX)));
        uiCollection.setDimensions(70, 70, TextIDs.TID_CONTRACT_ID_6_NAME, TextIDs.TID_TUTORIAL_MESSAGE_2);
        UiTextField uiTextField = new UiTextField(missionObject.getNameText());
        UiScrollingTextBox uiScrollingTextBox = new UiScrollingTextBox();
        UiButton uiButtonCreateButtonPositive = UiScript.createButtonPositive(TextStore.getInstance().get(2));
        uiButtonCreateButtonPositive.enlargeHitArea(50, 50);
        uiScrollingTextBox.setDimensions(20, 50, uiCollection.getWidth() - 40, 110);
        uiScrollingTextBox.setText(UiScript.loadText(TextIDs.TID_MISSION_ACCOMPLISHED));
        uiScrollingTextBox.setAlignment(17);
        uiTextField.setPos(uiCollection.getWidth() >> 1, 10);
        uiButtonCreateButtonPositive.setPos((uiCollection.getWidth() - uiButtonCreateButtonPositive.getWidth()) >> 1, (-10) + (uiCollection.getHeight() - uiButtonCreateButtonPositive.getHeight()));
        uiTextField.setAlignment(17);
        uiButtonCreateButtonPositive.setEvent(3);
        uiCollection.addComponent(uiTextField);
        uiCollection.addComponent(uiScrollingTextBox);
        uiCollection.addComponent(uiButtonCreateButtonPositive);
        return uiCollection;
    }

    public static int[] getCommerceMissionUniqueBuildings() {
        return smCommerceMissionUniqueBoughtBuildings;
    }

    public static int getCondition(int i2) {
        return DATA[indexOf(i2)][4];
    }

    public static int getIndexbySku(int i2) {
        return indexOf(i2);
    }

    public static MissionObject getMissionAccomplishedObject() {
        for (int i2 = 0; i2 < DATA.length; i2++) {
            MissionObject missionObject = smMissionObjects[i2];
            int sku = missionObject.getSku();
            if (isCompleted(sku) && !isCollected(sku)) {
                if (!smMissionPopUpVisited[indexOf(sku)]) {
                    softkey_sku = sku;
                    return missionObject;
                }
            }
        }
        return null;
    }

    public static int getName(int i2) {
        return DATA[indexOf(i2)][6];
    }

    public static int getUnlockLevel(int i2) {
        return DATA[indexOf(i2)][2];
    }

    public static int getUnlockSku(int i2) {
        return DATA[indexOf(i2)][1];
    }

    public static int[] getWondersMissionUniqueBuildings() {
        return smWondersMissionUniqueBought;
    }

    public static boolean hasAllWondersBeenBoughtForMission() {
        for (int i2 = 0; i2 < 3; i2++) {
            if (smWondersMissionUniqueBought[i2] == -1) {
                return false;
            }
        }
        return true;
    }

    public static boolean hasThisBuildingBeenBoughtForCommerceMission(int i2) {
        for (int i3 = 0; i3 < 5; i3++) {
            if (smCommerceMissionUniqueBoughtBuildings[i3] == i2) {
                return true;
            }
        }
        return false;
    }

    public static boolean hasThisWonderBeenBoughtForMission(int i2) {
        for (int i3 = 0; i3 < 3; i3++) {
            if (smWondersMissionUniqueBought[i3] == i2) {
                return true;
            }
        }
        return false;
    }

    public static final boolean improve(int i2) {
        if (!isCompleted(i2) && isUnlocked(i2)) {
            int iIndexOf = indexOf(i2);
            int[] iArr = smAmountCounted;
            iArr[iIndexOf] = iArr[iIndexOf] + 1;
            if (isCompleted(i2)) {
                mScreenNeedsRefresh = true;
                missionCompleted(i2);
                return true;
            }
            smMissionObjects[iIndexOf].updateProgress(smAmountCounted[iIndexOf]);
        }
        return false;
    }

    private static void improveUniqueBuildingsMission(int i2) {
        if (isCompleted(9) || !isUnlocked(9) || hasThisBuildingBeenBoughtForCommerceMission(i2)) {
            return;
        }
        setUniqueBuildingBought(i2);
        improve(9);
    }

    private static void improveUniqueWondersMission(int i2) {
        if (isCompleted(36) || !isUnlocked(36) || hasThisWonderBeenBoughtForMission(i2)) {
            return;
        }
        setUniqueWonderBought(i2);
        if (hasAllWondersBeenBoughtForMission()) {
            improve(36);
        }
    }

    private static int indexOf(int i2) {
        return smIndexes[i2];
    }

    public static final boolean isCollected(int i2) {
        return smCollected[indexOf(i2)];
    }

    public static final boolean isCompleted(int i2) {
        int iIndexOf = indexOf(i2);
        return smAmountCounted[iIndexOf] >= DATA[iIndexOf][3];
    }

    public static boolean isInitialized() {
        return smIsInitialized;
    }

    public static boolean isNewMissionCompleted() {
        for (int i2 = 0; i2 < DATA.length; i2++) {
            int sku = smMissionObjects[i2].getSku();
            if (isCompleted(sku) && !isCollected(sku)) {
                softkey_sku = sku;
                return true;
            }
        }
        return false;
    }

    public static final boolean isUnlocked(int i2) {
        int iIndexOf = indexOf(i2);
        if (DATA[iIndexOf][1] == -1) {
            return DATA[iIndexOf][2] <= smUser.getLevel();
        }
        return DATA[iIndexOf][2] <= smUser.getLevel() && isCompleted(DATA[iIndexOf][1]);
    }

    public static void loadRecordStore(DChocByteArray dChocByteArray) {
        try {
            if (!hackMission) {
                int i2 = dChocByteArray.readInt();
                if (smAmountCounted == null) {
                    smAmountCounted = new int[DATA.length];
                }
                if (smCompleted == null) {
                    smCompleted = new boolean[DATA.length];
                }
                if (smCollected == null) {
                    smCollected = new boolean[DATA.length];
                }
                if (smCommerceMissionUniqueBoughtBuildings == null) {
                    smCommerceMissionUniqueBoughtBuildings = new int[5];
                }
                if (smWondersMissionUniqueBought == null) {
                    smWondersMissionUniqueBought = new int[3];
                }
                for (int i3 = 0; i3 < i2; i3++) {
                    smAmountCounted[i3] = dChocByteArray.readInt();
                    smCompleted[i3] = dChocByteArray.readBoolean();
                    smCollected[i3] = dChocByteArray.readBoolean();
                }
                for (int i4 = 0; i4 < 5; i4++) {
                    smCommerceMissionUniqueBoughtBuildings[i4] = dChocByteArray.readInt();
                }
                for (int i5 = 0; i5 < 3; i5++) {
                    smWondersMissionUniqueBought[i5] = dChocByteArray.readInt();
                    if (!ApplicationStates.smIsGamePlayRestored) {
                        smWondersMissionUniqueBought[i5] = -1;
                    }
                }
                return;
            }
            int i6 = dChocByteArray.readInt();
            if (smAmountCounted == null) {
                smAmountCounted = new int[DATA.length];
            }
            if (smCompleted == null) {
                smCompleted = new boolean[DATA.length];
            }
            if (smCollected == null) {
                smCollected = new boolean[DATA.length];
            }
            if (smCommerceMissionUniqueBoughtBuildings == null) {
                smCommerceMissionUniqueBoughtBuildings = new int[5];
            }
            if (smWondersMissionUniqueBought == null) {
                smWondersMissionUniqueBought = new int[3];
            }
            int length = hackMissions.length;
            for (int i7 = 0; i7 < i6; i7++) {
                boolean z = false;
                for (int i8 = 0; i8 < length; i8++) {
                    if (i7 == hackMissions[i8]) {
                        z = true;
                    }
                }
                smAmountCounted[i7] = dChocByteArray.readInt();
                smCompleted[i7] = dChocByteArray.readBoolean();
                smCollected[i7] = dChocByteArray.readBoolean();
                if (z) {
                    smAmountCounted[i7] = 0;
                    smCompleted[i7] = false;
                    smCollected[i7] = false;
                }
            }
            for (int i9 = 0; i9 < 5; i9++) {
                smCommerceMissionUniqueBoughtBuildings[i9] = dChocByteArray.readInt();
            }
            for (int i10 = 0; i10 < 3; i10++) {
                smWondersMissionUniqueBought[i10] = dChocByteArray.readInt();
            }
        } catch (EOFException e2) {
            e2.printStackTrace();
        }
    }

    private static final void missionCompleted(int i2) {
        smMissionObjects[indexOf(i2)].changeState(3);
        for (int i3 = 0; i3 < DATA.length; i3++) {
            if (!isCompleted(DATA[i3][0])) {
                if (DATA[i3][1] == -1) {
                    if (DATA[i3][2] <= smUser.getLevel()) {
                        smMissionObjects[i3].changeState(1);
                    }
                } else if (DATA[i3][2] <= smUser.getLevel() && DATA[i3][1] == i2) {
                    smMissionObjects[i3].changeState(1);
                }
            }
        }
    }

    public static void saveRecordStore(DChocByteArray dChocByteArray) {
        dChocByteArray.writeInt(smAmountCounted.length);
        for (int i2 = 0; i2 < smAmountCounted.length; i2++) {
            dChocByteArray.writeInt(smAmountCounted[i2]);
            dChocByteArray.writeBoolean(smCompleted[i2]);
            dChocByteArray.writeBoolean(smCollected[i2]);
        }
        for (int i3 = 0; i3 < 5; i3++) {
            dChocByteArray.writeInt(smCommerceMissionUniqueBoughtBuildings[i3]);
        }
        for (int i4 = 0; i4 < 3; i4++) {
            dChocByteArray.writeInt(smWondersMissionUniqueBought[i4]);
        }
    }

    public static final boolean setAmountAchieved(int i2, int i3) {
        if (!isCompleted(i2) && isUnlocked(i2)) {
            int iIndexOf = indexOf(i2);
            smAmountCounted[iIndexOf] = i3;
            if (isCompleted(i2)) {
                mScreenNeedsRefresh = true;
                missionCompleted(i2);
                return true;
            }
            smMissionObjects[iIndexOf].updateProgress(smAmountCounted[iIndexOf]);
        }
        return false;
    }

    public static void setMissionPopUpVisited(int i2) {
        smMissionPopUpVisited[indexOf(i2)] = true;
    }

    public static void setUniqueBuildingBought(int i2) {
        for (int i3 = 0; i3 < 5; i3++) {
            if (smCommerceMissionUniqueBoughtBuildings[i3] == -1) {
                smCommerceMissionUniqueBoughtBuildings[i3] = i2;
                return;
            }
        }
    }

    public static void setUniqueWonderBought(int i2) {
        for (int i3 = 0; i3 < 3; i3++) {
            if (smWondersMissionUniqueBought[i3] == -1) {
                smWondersMissionUniqueBought[i3] = i2;
                return;
            }
        }
    }

    public static final void updateMissionsOnLevelUp() {
        for (int i2 = 0; i2 < DATA.length; i2++) {
            if (!isCompleted(DATA[i2][0]) && DATA[i2][1] == -1 && DATA[i2][2] <= smUser.getLevel() && smMissionObjects[i2].getState() == 2) {
                smMissionObjects[i2].changeState(1);
                mScreenNeedsRefresh = true;
            }
        }
    }

    public void addMission(MissionObject missionObject) {
        int columnCount = this.mMissionsTable.getColumnCount();
        this.mMissionsTable.setContentAt(missionObject, columnCount, 0);
        if (Toolkit.getScreenWidth() >= 480) {
            this.mMissionsTable.getCellAt(columnCount + 1, 0).setWidth(10);
        } else {
            this.mMissionsTable.getCellAt(columnCount + 1, 0).setWidth(70);
        }
    }

    @Override // com.dchoc.dollars.UiCollection, com.dchoc.dollars.UiComponent
    protected void draw(IRenderingPlatform iRenderingPlatform) {
        super.draw(iRenderingPlatform);
        if (this.mInfoPopup != null) {
            this.mInfoPopup.doDraw(iRenderingPlatform);
        }
        if (this.mLockedPopup != null) {
            this.mLockedPopup.doDraw(iRenderingPlatform);
        }
        if (this.mRewardPopup != null) {
            Toolkit.removeAllSoftKeys();
            this.mRewardPopup.doDraw(iRenderingPlatform);
        }
    }

    @Override // com.dchoc.dollars.UiCollection, com.dchoc.dollars.UiComponent
    public void gestureOccurred(GestureEvent gestureEvent) {
        if (this.mInfoPopup == null && this.mLockedPopup == null && this.mRewardPopup == null) {
            super.gestureOccurred(gestureEvent);
            return;
        }
        if (this.mInfoPopup != null) {
            this.mInfoPopup.gestureOccurred(gestureEvent);
        } else if (this.mLockedPopup != null) {
            this.mLockedPopup.gestureOccurred(gestureEvent);
        } else if (this.mRewardPopup != null) {
            this.mRewardPopup.gestureOccurred(gestureEvent);
        }
    }

    @Override // com.dchoc.dollars.UiCollection, com.dchoc.dollars.UiComponent
    public void keyEventOccurred(int i2, int i3, int i4) {
        if (this.mInfoPopup == null && this.mLockedPopup == null && this.mRewardPopup == null) {
            super.keyEventOccurred(i2, i3, i4);
            return;
        }
        if (this.mInfoPopup != null) {
            this.mInfoPopup.keyEventOccurred(i2, i3, i4);
        } else if (this.mLockedPopup != null) {
            this.mLockedPopup.keyEventOccurred(i2, i3, i4);
        } else if (this.mRewardPopup != null) {
            this.mRewardPopup.keyEventOccurred(i2, i3, i4);
        }
    }

    public void languageChanged() {
        if (smMissionObjects != null) {
            for (int i2 = 0; i2 < smMissionObjects.length; i2++) {
                smMissionObjects[i2].languageChanged();
            }
        }
    }

    @Override // com.dchoc.dollars.UiCollection, com.dchoc.dollars.UiComponent
    public UiEvent logicUpdate(int i2) {
        UiEvent uiEvent = UiEvent.NO_EVENT;
        if (!isVisible()) {
            return uiEvent;
        }
        if (this.mInfoPopup == null && this.mLockedPopup == null && this.mRewardPopup == null) {
            UiEvent uiEventLogicUpdate = super.logicUpdate(i2);
            if (uiEventLogicUpdate.getId() == 41) {
                super.keyEventOccurred(13, 1, 13);
                return uiEventLogicUpdate;
            }
            if (uiEventLogicUpdate.getId() == 40) {
                super.keyEventOccurred(11, 1, 11);
                return uiEventLogicUpdate;
            }
            if (uiEventLogicUpdate.getId() == 21 || UiScript.leftSoftkeyPressed) {
                int parameter = uiEventLogicUpdate.getParameter();
                UiScript.leftSoftkeyPressed = false;
                MissionObject missionObject = smMissionObjects[indexOf(parameter)];
                this.mRewardSku = parameter;
                this.mRewardPopup = UiScript.createGetRewardScreen(missionObject.getReward());
                return uiEventLogicUpdate;
            }
            if (uiEventLogicUpdate.getId() == 20) {
                this.mInfoPopup = createInfoPopup(smMissionObjects[indexOf(uiEventLogicUpdate.getParameter())]);
                return uiEventLogicUpdate;
            }
            if (uiEventLogicUpdate.getId() != 27) {
                return uiEventLogicUpdate;
            }
            this.mLockedPopup = createLockedPopup(smMissionObjects[indexOf(uiEventLogicUpdate.getParameter())]);
            return uiEventLogicUpdate;
        }
        if (this.mInfoPopup != null) {
            UiEvent uiEventLogicUpdate2 = this.mInfoPopup.logicUpdate(i2);
            if (uiEventLogicUpdate2.getId() != 3) {
                return uiEventLogicUpdate2;
            }
            this.mInfoPopup = null;
            return uiEventLogicUpdate2;
        }
        if (this.mLockedPopup != null) {
            UiEvent uiEventLogicUpdate3 = this.mLockedPopup.logicUpdate(i2);
            if (uiEventLogicUpdate3.getId() != 3) {
                return uiEventLogicUpdate3;
            }
            this.mLockedPopup = null;
            return uiEventLogicUpdate3;
        }
        if (this.mRewardPopup == null) {
            return uiEvent;
        }
        UiEvent uiEventLogicUpdate4 = this.mRewardPopup.logicUpdate(i2);
        if (uiEventLogicUpdate4.getId() == 30) {
            int iIndexOf = indexOf(this.mRewardSku);
            DollarsFacebookConnection.getInstance().postFacebookRewardMessage(UiScript.loadText(DATA[iIndexOf][6]), "$" + DATA[iIndexOf][5], null);
            return UiEvent.NO_EVENT;
        }
        if (uiEventLogicUpdate4.getId() != 7 && !UiScript.rightSoftkeyPressed) {
            return uiEventLogicUpdate4;
        }
        this.mRewardPopup = null;
        MissionObject missionObject2 = smMissionObjects[indexOf(this.mRewardSku)];
        UiScript.increaseHudCash(missionObject2.getReward());
        removeMission(missionObject2);
        checkIfAllMissionCompletedHaveBeenCollected();
        UiScript.rightSoftkeyPressed = false;
        return UiEvent.NO_EVENT;
    }

    public void removeAllMissions() {
        if (this.mMissionsTable == null) {
            return;
        }
        for (int i2 = 0; i2 < this.mMissionsTable.getColumnCount(); i2++) {
            this.mMissionsTable.setContentAt(null, 0, 0);
            if (Toolkit.getScreenWidth() >= 480) {
                this.mMissionsTable.getCellAt(0, 0).setWidth(0);
            } else {
                this.mMissionsTable.getCellAt(0, 0).setWidth(70);
            }
        }
    }

    public void removeMission(MissionObject missionObject) {
        if (this.mMissionsTable == null) {
            return;
        }
        for (int i2 = 0; i2 < this.mMissionsTable.getColumnCount(); i2++) {
            if (this.mMissionsTable.getCellAt(i2, 0).getContent() == missionObject) {
                this.mMissionsTable.setContentAt(null, i2, 0);
                if (Toolkit.getScreenWidth() >= 480) {
                    this.mMissionsTable.getCellAt(i2 + 1, 0).setWidth(0);
                    break;
                } else {
                    this.mMissionsTable.getCellAt(i2 + 1, 0).setWidth(70);
                    break;
                }
            }
        }
        int sku = missionObject.getSku();
        collectedMissionCount++;
        smCompleted[indexOf(sku)] = true;
        smCollected[indexOf(sku)] = true;
        updateMissionCards();
    }

    public void updateMissionCards() {
        mScreenNeedsRefresh = false;
        int length = DATA.length;
        smCompletedMissionObjects = new MissionObject[length];
        smOpenMissionObjects = new MissionObject[length];
        smLockedMissionObjects = new MissionObject[length];
        removeAllMissions();
        this.mMissionsTable = new UiTable();
        if (Toolkit.getScreenWidth() >= 480) {
            this.mMissionsTable.setPos(this.mContents.getX() + this.mContents.getPaddingLeft(), this.mContents.getY() + this.mContents.getPaddingTop());
            this.mMissionsTable.getCellAt(0, 0).setWidth(25);
        } else {
            this.mMissionsTable.setPos((this.mContents.getX() + this.mContents.getPaddingLeft()) - 5, this.mContents.getY() + this.mContents.getPaddingTop());
            this.mMissionsTable.getCellAt(0, 0).setWidth(70);
        }
        this.mContents.setContent(this.mMissionsTable, false, false);
        for (int i2 = 0; i2 < length; i2++) {
            int sku = smMissionObjects[i2].getSku();
            if (isCompleted(sku)) {
                missionCompleted(sku);
            }
        }
        int i3 = 0;
        int i4 = 0;
        int i5 = 0;
        for (int i6 = 0; i6 < DATA.length; i6++) {
            if (smMissionObjects[i6].getState() == 3) {
                if (!isCollected(smMissionObjects[i6].getSku())) {
                    smCompletedMissionObjects[i5] = smMissionObjects[i6];
                    i5++;
                }
            } else if (smMissionObjects[i6].getState() == 1) {
                smOpenMissionObjects[i4] = smMissionObjects[i6];
                i4++;
            } else if (smMissionObjects[i6].getState() == 2) {
                smLockedMissionObjects[i3] = smMissionObjects[i6];
                i3++;
            }
        }
        AddMissionsFromArray(smCompletedMissionObjects);
        AddMissionsFromArray(smOpenMissionObjects);
        AddMissionsFromArray(smLockedMissionObjects);
        if (Toolkit.getScreenWidth() >= 480) {
            this.mMissionsTable.getCellAt(this.mMissionsTable.getColumnCount() + 1, 0).setWidth(150);
        } else {
            this.mMissionsTable.getCellAt(this.mMissionsTable.getColumnCount() + 1, 0).setWidth(70);
        }
    }
}