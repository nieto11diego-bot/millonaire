package com.dchoc.dollars;

import com.sumea.levelfactory.plugin.LevelDataProvider;
import java.io.DataInputStream;

/* JADX INFO: loaded from: classes.dex */
public class ToolkitDataProvider implements LevelDataProvider {
    @Override // com.sumea.levelfactory.plugin.LevelDataProvider
    public DataInputStream getResourceData(int i2) {
        return Toolkit.getResourceStream(i2);
    }
}