#define ECG_PIN   34
#define LO_PLUS   32
#define LO_MINUS  33

void setup() {
  Serial.begin(115200);
  pinMode(LO_PLUS, INPUT);
  pinMode(LO_MINUS, INPUT);
}

void loop() {
  if (digitalRead(LO_PLUS) == 1 || digitalRead(LO_MINUS) == 1) {
    Serial.println("0");
  } else {
    int value = analogRead(ECG_PIN);
    Serial.println(value);
  }
  delay(4);
}