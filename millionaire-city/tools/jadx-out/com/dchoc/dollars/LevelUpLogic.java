package com.dchoc.dollars;

import java.io.EOFException;

/* JADX INFO: loaded from: classes.dex */
public class LevelUpLogic {
    public static final int BASE_EXPERIENCE = 100;
    private static final int BASE_LEVEL = 1;
    private static final boolean DEBUG_LEVELUP = false;
    private static int smExperience;
    public static int smExperiencePerLevel;
    public static int smLevel;
    private static final int BASE_EXPERIENCEPERLEVEL = 470;
    public static final int[] LEVEL_THRESHOLDS = {0, BASE_EXPERIENCEPERLEVEL, 1010, 1580, 2220, 2890, 3600, 4500, 5630, 7130, 9010, 11410, 14110, 16910, 19810, 24820, 31490, 41490, 53490, 68160, 85490, 104820, 128150, 161480, 198150, 238150, 281480, 341480, 409480, 489480, 589480, 701480, 825480, 961480, 1109480, 1269480, 1441480, 1617480, 1805480, 2005480, 2217480, 2449480, 2689480, 2945480, 3225480, 3521480, 3841480, 4181480, 4541480, 4941480, 5381480, 5429480, 5481480, 5537480, 5597480, 5661480, 5729480, 5801480, 5877480, 5957480, 6041480, 6129480, 6221480, 6317480, 6417480, 6521480, 6629480, 6741480, 6857480, 6977480, 7101480, 7229480, 7361480, 7497480, 7637480, 7781480, 7929480, 8081480, 8237480, 8397480, 8561480, 8729480, 8905480, 9089480, 9281480, 9481480, 9689480, 9905480, 10129480, 10361480, 10601480, 10849480, 11105480, 11369480, 11641480, 11921480, 12209480, 12505480, 12809480, 13121480, -1};

    public LevelUpLogic() {
        smExperience = 100;
        smLevel = 1;
        if (Toolkit.getScreenWidth() >= 480) {
            UiScript.setHudExperience(getExperience(), getPreviousTreshold(), getCurrentTreshold());
        } else {
            smExperiencePerLevel = BASE_EXPERIENCEPERLEVEL;
            UiScript.setHudExperience(getExperience(), getPreviousTreshold(), getCurrentTreshold(), getExperiencePerLevel());
        }
        UiScript.setHudLevelNumber(getLevel());
    }

    private boolean runLevelUpLogic() {
        if (LEVEL_THRESHOLDS[smLevel] < 0 || smExperience < LEVEL_THRESHOLDS[smLevel]) {
            return false;
        }
        for (int i2 = smLevel; i2 + 1 < LEVEL_THRESHOLDS.length && smExperience >= LEVEL_THRESHOLDS[i2]; i2++) {
            smLevel = i2 + 1;
        }
        return true;
    }

    public boolean addExperience(int i2) {
        if (i2 <= 0) {
            return false;
        }
        smExperience += i2;
        return runLevelUpLogic();
    }

    public int getCurrentTreshold() {
        return LEVEL_THRESHOLDS[smLevel] < 0 ? smExperience + 1 : LEVEL_THRESHOLDS[smLevel];
    }

    public int getExperience() {
        return smExperience;
    }

    public int getExperiencePerLevel() {
        return smExperiencePerLevel;
    }

    public int getLevel() {
        return smLevel;
    }

    public int getPreviousTreshold() {
        return LEVEL_THRESHOLDS[smLevel] < 0 ? smExperience : LEVEL_THRESHOLDS[smLevel - 1];
    }

    public void loadRecordStore(DChocByteArray dChocByteArray) throws EOFException {
        smExperience = dChocByteArray.readInt();
        smLevel = dChocByteArray.readInt();
        if (Toolkit.getScreenWidth() >= 480) {
            UiScript.setHudExperience(getExperience(), getPreviousTreshold(), getCurrentTreshold());
        } else {
            smExperiencePerLevel = LEVEL_THRESHOLDS[smLevel];
            UiScript.setHudExperience(getExperience(), getPreviousTreshold(), getCurrentTreshold(), getExperiencePerLevel());
        }
        UiScript.setHudLevelNumber(getLevel());
    }

    public void saveRecordStore(DChocByteArray dChocByteArray) {
        dChocByteArray.writeInt(smExperience);
        dChocByteArray.writeInt(smLevel);
    }

    public void setExperiencePerLevel(int i2) {
        smExperiencePerLevel = i2;
    }
}