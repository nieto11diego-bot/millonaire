package com.dchoc.dollars;

import com.sumea.levelfactory.plugin.LevelDataProvider;
import java.io.DataInputStream;
import java.io.IOException;

/* JADX INFO: loaded from: classes.dex */
public class LayerGameObjects {
    private int mColorToOverrideWith;
    private int mHeight;
    private ObjectLinkGameObjects[] mObjects;
    private boolean mOverrideColorFilters;
    private final int mTileheight;
    private final int mTilewidth;
    private int mWidth;

    public LayerGameObjects(int i2, LevelDataProvider levelDataProvider) throws IOException {
        DataInputStream resourceData = levelDataProvider.getResourceData(i2);
        this.mWidth = resourceData.readInt();
        this.mHeight = resourceData.readInt();
        this.mOverrideColorFilters = resourceData.readByte() != 0;
        this.mColorToOverrideWith = resourceData.readInt();
        this.mTilewidth = resourceData.readInt();
        this.mTileheight = resourceData.readInt();
        this.mObjects = new ObjectLinkGameObjects[resourceData.readShort()];
        for (int i3 = 0; i3 < this.mObjects.length; i3++) {
            this.mObjects[i3] = loadObject(resourceData.readUnsignedByte(), resourceData);
        }
    }

    private static ObjectLinkGameObjects loadObject(int i2, DataInputStream dataInputStream) throws IOException {
        switch (i2) {
            case 0:
                return new ObjectLinkGameObjects(new ObjectPlayer(dataInputStream));
            case 1:
                return new ObjectLinkGameObjects(new ObjectHouse(dataInputStream));
            case 2:
                return new ObjectLinkGameObjects(new ObjectCommercial(dataInputStream));
            case 3:
                return new ObjectLinkGameObjects(new ObjectDeco(dataInputStream));
            case 4:
                return new ObjectLinkGameObjects(new ObjectWonder(dataInputStream));
            case 5:
                return new ObjectLinkGameObjects(new ObjectHq(dataInputStream));
            case 6:
                return new ObjectLinkGameObjects(new ObjectCityExpansion(dataInputStream));
            case 7:
                return new ObjectLinkGameObjects(new ObjectTrigger(dataInputStream));
            case 8:
                return new ObjectLinkGameObjects(new ObjectMapStartLocation(dataInputStream));
            default:
                return null;
        }
    }

    public int getColorToOverrideWith() {
        return this.mColorToOverrideWith;
    }

    public int getHeight() {
        return this.mHeight;
    }

    public ObjectLinkGameObjects[] getObjects() {
        return this.mObjects;
    }

    public boolean getOverrideColorFilters() {
        return this.mOverrideColorFilters;
    }

    public int getTileheight() {
        return this.mTileheight;
    }

    public int getTilewidth() {
        return this.mTilewidth;
    }

    public int getWidth() {
        return this.mWidth;
    }

    public void setColorToOverrideWith(int i2) {
        this.mColorToOverrideWith = i2;
    }

    public void setHeight(int i2) {
        this.mHeight = i2;
    }

    public void setOverrideColorFilters(boolean z) {
        this.mOverrideColorFilters = z;
    }

    public void setWidth(int i2) {
        this.mWidth = i2;
    }
}