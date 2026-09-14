package com.dchoc.dollars;

import java.io.EOFException;
import java.lang.reflect.Array;

/* JADX INFO: loaded from: classes.dex */
public class LevelScript {
    private static final boolean DEBUG_EVENT_NUMBERS = false;
    public static final int EVENT_NONE = -1;
    private static int mCounterLength;
    private static int[][] mCounters;
    private static int mGoal;
    private static GameObject mPlayer;
    private static GameObject mSourceObject;
    private static User mUser;
    private static int smCurrentHintDuration;
    private static String smCurrentHintText;
    private static IRpgEngine smEngine;
    private static int smEventId;
    private static GameObject trigger;

    private static void activateFullScreenFadeEffect(int i2) {
        FadeScreen.playFadeEffect(i2, 192, 1000, 1);
    }

    private static final void addStoryCamera(GameObject gameObject, boolean z) {
        if (gameObject == null) {
            new Exception("[ERROR] Triggers.addStoryCamera() recieved an invalid object.").printStackTrace();
        } else {
            GameDialogue.addStoryCamera(gameObject, z);
        }
    }

    private static final void addStoryDelay(int i2) {
        if (i2 <= 0) {
            return;
        }
        GameDialogue.addStoryDelay(i2);
    }

    private static final void addStoryDialog(int i2, int i3) {
        if (i2 == -1 || i2 == -2) {
            return;
        }
        GameDialogue.addStoryDialog(TextStore.getInstance().get(i2), i3);
    }

    private static final void commonEvent() {
        int i2 = smEventId;
    }

    private static void createDelayTrigger(int i2) {
        createDelayTrigger(smEventId, i2);
    }

    private static void createDelayTrigger(int i2, int i3) {
        GameObject gameObjectAddGameObject = smEngine.addGameObject(64, (int[][]) null);
        gameObjectAddGameObject.setEventId(i2);
        gameObjectAddGameObject.setTimer(i3);
        gameObjectAddGameObject.setLifetime(i3);
    }

    private static void createNewCounter(int i2) {
        mCounterLength++;
        if (mCounters.length == mCounterLength) {
            int[][] iArr = new int[mCounters.length + 100][];
            for (int i3 = 0; i3 < mCounters.length; i3++) {
                iArr[i3] = mCounters[i3];
            }
            mCounters = iArr;
        }
        mCounters[mCounterLength - 1][0] = i2;
        mCounters[mCounterLength - 1][1] = 0;
    }

    public static final void decreaseCounter(int i2) {
        for (int i3 = 0; mCounters != null && i3 < mCounterLength; i3++) {
            if (mCounters[i3][0] == i2) {
                int[] iArr = mCounters[i3];
                iArr[1] = iArr[1] - 1;
                return;
            }
        }
    }

    private static final void disableAllObjectsWithId(int i2) {
        while (true) {
            GameObject gameObjectFindObject = findObject(i2);
            if (gameObjectFindObject == null) {
                return;
            } else {
                gameObjectFindObject.disable();
            }
        }
    }

    private static final void event() {
        if (smEventId < 0) {
            specialEvent();
        } else {
            commonEvent();
            eventFullVersion();
        }
    }

    public static final void event(int i2) {
        smEventId = i2;
        if (smEventId == -1) {
            return;
        }
        try {
            event();
        } catch (Exception e2) {
            e2.printStackTrace();
        }
    }

    public static final void event(GameObject gameObject) {
        if (gameObject.getEventId() == -1) {
            return;
        }
        setSourceObject(gameObject);
        event(gameObject.getEventId());
    }

    private static final void eventFullVersion() {
        switch (smEventId) {
            case 62:
                increaseCounter();
                break;
        }
    }

    private static final GameObject findObject(int i2) {
        return smEngine.findObject(i2);
    }

    private static final Camera2D getCamera() {
        return smEngine.getCamera();
    }

    private static final int getCounterValue() {
        return getCounterValue(smEventId);
    }

    private static final int getCounterValue(int i2) {
        for (int i3 = 0; mCounters != null && i3 < mCounterLength; i3++) {
            if (mCounters[i3][0] == i2) {
                return mCounters[i3][1];
            }
        }
        return 0;
    }

    public static int getHintDuration() {
        return smCurrentHintDuration;
    }

    public static String getHintText() {
        return smCurrentHintText;
    }

    private static final GameObject getObject() {
        return mSourceObject;
    }

    public static final GameObject getPlayer() {
        return mPlayer;
    }

    public static final User getUser() {
        return mUser;
    }

    private static final void increaseCounter() {
        increaseCounter(smEventId);
    }

    private static final void increaseCounter(int i2) {
        initCounterSystem();
        for (int i3 = 0; i3 < mCounterLength; i3++) {
            if (mCounters[i3][0] == i2) {
                int[] iArr = mCounters[i3];
                iArr[1] = iArr[1] + 1;
                return;
            }
        }
        createNewCounter(i2);
        increaseCounter(i2);
    }

    public static void initCounterSystem() {
        if (mCounters == null) {
            mCounters = (int[][]) Array.newInstance((Class<?>) Integer.TYPE, 100, 2);
            mCounterLength = 0;
        }
    }

    private static final boolean isCameraOnTarget() {
        return smEngine.getCamera().hasReachedDestination();
    }

    private static final void levelComplete() {
        smEngine.levelComplete();
    }

    public static void loadRecordStore(DChocByteArray dChocByteArray) throws EOFException {
        mCounterLength = dChocByteArray.readInt();
        int iMax = Math.max(mCounterLength, 100);
        if (mCounters == null || mCounters.length < iMax) {
            mCounters = (int[][]) Array.newInstance((Class<?>) Integer.TYPE, iMax, 2);
        }
        for (int i2 = 0; i2 < mCounterLength; i2++) {
            mCounters[i2][0] = dChocByteArray.readInt();
            mCounters[i2][1] = dChocByteArray.readInt();
        }
    }

    private static final void moveCameraBackToPlayer() {
        getCamera().setObjectToTrack(getPlayer(), 1);
    }

    private static final void playStory() {
        getPlayer().behaviorTalk(100);
        addStoryCamera(getPlayer(), false);
        GameDialogue.playStory(smEngine);
    }

    private static final void playStoryAndEnd() {
        if (findObject(-99) == null) {
            GameObject object = getObject();
            if (object != null) {
                object.setEventId(-1);
            }
            GameObject gameObjectAddGameObject = smEngine.addGameObject(64, (int[][]) null);
            gameObjectAddGameObject.setEventId(-99);
            gameObjectAddGameObject.setTimer(50);
        }
    }

    public static final void resetAllCounters() {
    }

    private static final void resetCounter() {
        for (int i2 = 0; mCounters != null && i2 < mCounterLength; i2++) {
            if (mCounters[i2][0] == smEventId) {
                mCounters[i2][1] = 0;
            }
        }
    }

    public static void saveRecordStore(DChocByteArray dChocByteArray) {
        dChocByteArray.writeInt(mCounterLength);
        for (int i2 = 0; i2 < mCounterLength; i2++) {
            dChocByteArray.writeInt(mCounters[i2][0]);
            dChocByteArray.writeInt(mCounters[i2][1]);
        }
    }

    private static final void setCounterValue(int i2) {
        setCounterValue(smEventId, i2);
    }

    private static final void setCounterValue(int i2, int i3) {
        initCounterSystem();
        for (int i4 = 0; i4 < mCounterLength; i4++) {
            if (mCounters[i4][0] == smEventId) {
                mCounters[i4][1] = i3;
                return;
            }
        }
        createNewCounter(i2);
        setCounterValue(i2, i3);
    }

    public static final void setEngine(IRpgEngine iRpgEngine) {
        smEngine = iRpgEngine;
    }

    public static final void setGoal(int i2) {
        mGoal = i2;
    }

    public static final void setPlayer(GameObject gameObject) {
        mPlayer = gameObject;
    }

    public static final void setSourceObject(GameObject gameObject) {
        mSourceObject = gameObject;
    }

    public static final void setUser(User user) {
        mUser = user;
    }

    private static final void showMessage(String str, int i2) {
        smCurrentHintText = str;
        smCurrentHintDuration = i2;
        smEngine.generateStateChangeEvent(101);
    }

    private static final void specialEvent() {
        switch (smEventId) {
            case -99:
                increaseCounter();
                if (getCounterValue() != 1) {
                    if (getCounterValue() != 2 && getCounterValue() == 3) {
                        levelComplete();
                        getObject().setActive(false);
                        break;
                    }
                } else {
                    playStory();
                    break;
                }
                break;
        }
    }

    private static void triggerSwitch(GameObject gameObject) {
        if (gameObject.isActive()) {
            gameObject.setActive(false);
            gameObject.getTarget().setActive(true);
            gameObject.getTarget().setElapsedAnimationTime(0);
        } else {
            gameObject.setActive(true);
            gameObject.setElapsedAnimationTime(0);
            gameObject.getTarget().setActive(false);
        }
    }
}