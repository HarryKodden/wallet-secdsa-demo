plugins {
    kotlin("jvm") version "2.4.0"
    kotlin("plugin.serialization") version "2.4.0"
    application
}

group = "id.walt"
version = "0.23.1-secdsa"

val waltidVersion = "0.23.1"
val ktorVersion = "3.5.0"
val hopliteVersion = "2.9.0"

repositories {
    mavenCentral()
    maven { url = uri("https://maven.waltid.dev/releases") }
    maven { url = uri("https://maven.waltid.dev/snapshots") }
}

dependencies {
    // Stock walt.id wallet-api2 libraries (no waltid-identity checkout)
    implementation("id.walt.protocols:waltid-openid4vc-wallet-server:$waltidVersion")
    implementation("id.walt.protocols:waltid-openid4vc-wallet-persistence-server:$waltidVersion")
    // Compile classpath for eduWallet overlay sources (runtime also via wallet-server)
    implementation("id.walt.protocols:waltid-openid4vc-wallet-jvm:$waltidVersion")
    implementation("id.walt.protocols:waltid-openid4vci-wallet-jvm:$waltidVersion")
    implementation("id.walt.protocols:waltid-openid4vp-wallet-jvm:$waltidVersion")
    implementation("id.walt.protocols:waltid-openid4vp-clientidprefix-jvm:$waltidVersion")
    implementation("id.walt.protocols:waltid-openid4vp-jvm:$waltidVersion")
    implementation("id.walt.dcql:waltid-dcql-jvm:$waltidVersion")
    implementation("id.walt.credentials:waltid-digital-credentials-jvm:$waltidVersion")
    implementation("org.kotlincrypto.hash:sha2-jvm:0.8.0")
    implementation("dev.whyoleg.cryptography:cryptography-random-jvm:0.6.0")
    implementation("id.walt:waltid-service-commons:$waltidVersion")
    implementation("id.walt:waltid-ktor-authnz:$waltidVersion")
    implementation("id.walt.crypto:waltid-crypto-jvm:$waltidVersion")
    implementation("id.walt.did:waltid-did-jvm:$waltidVersion")

    // SECDSA adapter sources are compiled into this project (see sourceSets)
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    implementation(kotlin("stdlib"))
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.10.1")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.0")

    implementation("io.ktor:ktor-server-core-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-cio-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-auth-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-auth-jwt-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-sessions-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-auto-head-response-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-compression-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-cors-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-forwarded-header-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-call-logging-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-call-id-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-content-negotiation-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-host-common-jvm:$ktorVersion")
    implementation("io.ktor:ktor-serialization-kotlinx-json-jvm:$ktorVersion")
    implementation("io.ktor:ktor-client-cio-jvm:$ktorVersion")
    implementation("io.ktor:ktor-client-content-negotiation-jvm:$ktorVersion")

    implementation("com.sksamuel.hoplite:hoplite-core:$hopliteVersion")
    implementation("com.sksamuel.hoplite:hoplite-hocon:$hopliteVersion")

    implementation("io.github.oshai:kotlin-logging-jvm:7.0.3")
    runtimeOnly("org.postgresql:postgresql:42.7.5")

    testImplementation(kotlin("test"))
}

kotlin {
    jvmToolchain(21)
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_21)
        // Overlay sources share packages with walt.id jars (classpath shadow at runtime).
        freeCompilerArgs.add("-Xsuppress-version-warnings")
    }
}

sourceSets {
    main {
        kotlin {
            // Compile vendored SECDSA adapter (exclude demo CLI entrypoint)
            srcDir("../secdsa-waltid-adapter/src/main/kotlin")
            exclude("**/nl/harrykodden/secdsa/waltid/Main.kt")
        }
    }
}

application {
    mainClass.set("id.walt.wallet2.MainKt")
}

tasks.named<Jar>("jar") {
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
    archiveBaseName.set("waltid-wallet-api2-secdsa")
}

tasks.register<Copy>("installDistToDist") {
    dependsOn("installDist")
    val installDir = layout.buildDirectory.dir("install/waltid-wallet-api2")
    from(installDir)
    into(layout.projectDirectory.dir("dist"))
    doFirst {
        delete(layout.projectDirectory.dir("dist"))
        val dir = installDir.get().asFile
        require(dir.isDirectory) { "installDist missing at $dir — run installDist first" }
    }
    doLast {
        delete(
            fileTree(layout.projectDirectory.dir("dist/lib")) {
                include("bcprov-jdk18on-*.jar", "bcpkix-jdk18on-*.jar", "bcutil-jdk18on-*.jar")
            }
        )
    }
}

