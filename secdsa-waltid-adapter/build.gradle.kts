plugins {
    kotlin("jvm") version "2.4.0"
    kotlin("plugin.serialization") version "2.4.0"
    application
}

group = "nl.harrykodden"
version = "0.1.0-SNAPSHOT"

repositories {
    mavenCentral()
    maven { url = uri("https://maven.waltid.dev/releases") }
    // walt.id forks kotlinx-serialization (…-waltid_*-SNAPSHOT)
    maven { url = uri("https://maven.waltid.dev/snapshots") }
}

dependencies {
    implementation(kotlin("stdlib"))
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.10.1")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // walt.id Key contract (same family as AWS / TSE backends)
    implementation("id.walt.crypto:waltid-crypto:0.23.0")
    // KeySerialization / TSE types pull in ktor client at class-init
    implementation("io.ktor:ktor-client-cio:3.5.0")

    testImplementation(kotlin("test"))
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.1")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

// walt.id 0.23 needs Kotlin 2.4; quiet the Gradle 8.12 deprecation noise until we bump the wrapper


application {
    mainClass.set("nl.harrykodden.secdsa.waltid.MainKt")
}

tasks.test {
    useJUnitPlatform()
}
