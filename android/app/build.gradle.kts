plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.fresteban.didicopiloto"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.fresteban.didicopiloto"
        minSdk = 26
        targetSdk = 35
        versionCode = 5
        versionName = "0.1.4"

        // El teléfono objetivo es arm64; evita empaquetar ML Kit para ABIs que no se usan.
        ndk {
            abiFilters += listOf("arm64-v8a")
        }

        buildConfigField("String", "PWA_BASE_URL", "\"https://fresteban2010.github.io/Proyecto-DIDI/\"")
    }

    signingConfigs {
        // Clave estable para sideload: permite actualizar el APK sin desinstalar.
        // No es una clave de Play Store; el keystore vive en el repo a propósito.
        create("sideload") {
            storeFile = file("didi-sideload.keystore")
            storePassword = "didi-copiloto"
            keyAlias = "didi-copiloto"
            keyPassword = "didi-copiloto"
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("sideload")
        }
        release {
            signingConfig = signingConfigs.getByName("sideload")
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
        buildConfig = true
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")

    // OCR on-device: lee la oferta cuando DiDi no expone nodos de accesibilidad.
    implementation("com.google.mlkit:text-recognition:16.0.1")

    testImplementation("junit:junit:4.13.2")
}
